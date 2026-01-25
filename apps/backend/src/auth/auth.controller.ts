import {
    Controller,
    Get,
    Post,
    Query,
    Req,
    Res,
    UnauthorizedException
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';
import { KeycloakService } from './keycloak/keycloak.service';
import { ContextLogger } from '../common/logger/context.logger';
@Controller('auth')
export class AuthController {
    private readonly logger = new ContextLogger(AuthController.name);

    constructor(
        private readonly auth: AuthService,
        private readonly keycloak: KeycloakService,
    ) { }

    @Get('login')
    @Public()
    login(
        @Query('redirectTo') redirectTo = '/',
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
    ) {
        this.logger.log(
            `Login requested from ${req.ip}, redirectTo=${redirectTo}`,
        );

        const state = Buffer.from(
            JSON.stringify({ redirectTo }),
        ).toString('base64');

        const url = this.keycloak.getLoginUrl(state);

        this.logger.debug('Redirecting user to Keycloak authorization endpoint');
        return res.redirect(url);
    }

    @Get('callback')
    @Public()
    async callback(
        @Query('code') code: string,
        @Query('state') state: string,
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
    ) {
        this.logger.log('OAuth callback received from Keycloak');

        const tokens = await this.keycloak.exchangeCode(code);
        this.logger.debug('Authorization code successfully exchanged');

        this.auth.setAuthCookies(res, tokens, req);

        let redirectTo = '/';
        if (state) {
            try {
                redirectTo = JSON.parse(
                    Buffer.from(state, 'base64').toString(),
                ).redirectTo;
            } catch {
                this.logger.warn('Invalid OAuth state parameter');
            }
        }

        this.logger.log(`Login completed, redirecting to frontend: ${redirectTo}`);
        return res.redirect(
            `${process.env.FRONT_END_BASE_URL}${redirectTo}`,
        );
    }

    @Post('refresh')
    @Public()
    async refresh(
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
    ) {
        const hasRefreshToken = !!req.cookies?.REFRESH_TOKEN;

        this.logger.log(
            `Refresh requested (refreshTokenPresent=${hasRefreshToken})`,
        );

        if (!hasRefreshToken) {
            this.logger.warn('Refresh denied: no refresh token cookie');
            throw new UnauthorizedException();
        }

        const tokens = await this.keycloak.refresh(req.cookies.REFRESH_TOKEN);
        this.logger.debug('Access token refreshed successfully');

        this.auth.setAccessCookie(res, tokens.access_token, req);
        return { ok: true };
    }

    @Post('logout')
    @Public()
    async logout(
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
    ) {
        this.logger.log('Logout requested');

        const hasRefreshToken = !!req.cookies?.REFRESH_TOKEN;
        this.logger.debug(
            `Refresh token present during logout: ${hasRefreshToken}`,
        );

        if (hasRefreshToken) {
            try {
                await this.keycloak.keycloakLogout(req.cookies.REFRESH_TOKEN);
                this.logger.log('Keycloak SSO session terminated');
            } catch (err) {
                this.logger.warn('Keycloak logout failed (continuing app logout)');
            }
        }

        this.auth.clearCookies(res, req);
        this.logger.log('Application auth cookies cleared');

        return { success: true };
    }

    @Get('me')
    me(@Req() req: any) {
        this.logger.debug(
            `Me endpoint accessed (user=${req.user?.id ?? 'anonymous'})`,
        );
        return req.user;
    }
}
