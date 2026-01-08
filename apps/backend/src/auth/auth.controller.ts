import {
    Controller,
    Get,
    Post,
    Req,
    Res,
    Body,
    Query,
    UnauthorizedException,
} from '@nestjs/common';
import express from 'express';

import { AuthService } from './auth.service';
import { KeycloakService } from './keycloak/keycloak.service';
import { resolveCookieDomain } from './utils/cookie-domain.util';
import { Public } from './decorators/public.decorator';


@Controller('auth')
export class AuthController {
    constructor(
        private readonly auth: AuthService,
        private readonly keycloak: KeycloakService,
    ) { }

    @Get('login')
    @Public()
    login(
        @Query('redirectTo') redirectTo = '/board',
        @Res() res: express.Response,
    ) {
        const state = Buffer.from(JSON.stringify({ redirectTo })).toString('base64');
        const loginUrl = this.keycloak.getLoginUrl(state);
        return res.redirect(loginUrl);
    }

    @Get('status')
    status(@Req() req: express.Request) {
        const sessionId = req.cookies?.['SESSION_ID'];
        return { authenticated: !!sessionId };
    }

    // 🔐 REQUIRED BY FRONTEND
    @Get('me')
    async me(@Req() req: express.Request) {
        const sessionId = req.cookies?.['SESSION_ID'];
        if (!sessionId) {
            throw new UnauthorizedException();
        }

        const user = await this.auth.getSessionUser(sessionId);
        if (!user) {
            throw new UnauthorizedException();
        }

        return {
            id: user.id,
            email: user.email,
            permissions: user.permissions,
        };
    }

    @Get('callback')
    @Public()
    async callback(
        @Query('code') code: string,        // ✅ FIX
        @Query('state') state: string,
        @Req() req: express.Request,
        @Res({ passthrough: true }) res: express.Response,
    ) {
        if (!code) {
            throw new UnauthorizedException('Missing authorization code');
        }

        const sessionId = await this.auth.login(code);

        res.cookie('SESSION_ID', sessionId, {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            domain: resolveCookieDomain(req),
            maxAge: 1000 * 60 * 60 * 24,
        });

        let redirectTo = '/board';

        if (state) {
            try {
                const parsed = JSON.parse(Buffer.from(state, 'base64').toString());
                redirectTo = parsed.redirectTo;
            } catch { }
        }

        return res.redirect(`${process.env.FRONT_END_BASE_URL}${redirectTo}`);
    }


    @Post('logout')
    logout(
        @Req() req: express.Request,
        @Res({ passthrough: true }) res: express.Response,
    ) {
        const sessionId = req.cookies?.['SESSION_ID'];
        if (sessionId) {
            this.auth.logout(sessionId);
        }

        res.clearCookie('SESSION_ID');
        return { success: true };
    }
}
