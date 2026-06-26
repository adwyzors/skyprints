import {
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ContextLogger } from '../common/logger/context.logger';
import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';
import { KeycloakService } from './keycloak/keycloak.service';
@Controller('auth')
export class AuthController {
  private readonly logger = new ContextLogger(AuthController.name);

  constructor(
    private readonly auth: AuthService,
    private readonly keycloak: KeycloakService,
  ) {}

  @Get('login')
  @Public()
  login(
    @Query('redirectTo') redirectTo = '/',
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.logger.log(`Login requested from ${req.ip}, redirectTo=${redirectTo}`);

    const state = Buffer.from(JSON.stringify({ redirectTo })).toString(
      'base64',
    );

    const url = this.keycloak.getLoginUrl(state);
    res.redirect(url);
    return;
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

    // Decode redirectTo early — needed for both success and fallback paths.
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

    try {
      const tokens = await this.keycloak.exchangeCode(code);
      this.logger.log('Authorization code successfully exchanged');
      this.auth.setAuthCookies(res, tokens, req);
    } catch (err: any) {
      // Codes are single-use. On Vercel, the serverless function can be invoked
      // twice for the same request (cold-start replay), or the user reloads the
      // callback URL from browser history. In both cases the second attempt gets
      // invalid_grant. Redirect to the frontend — if the first exchange already
      // set a session the user lands normally; otherwise AuthProvider re-initiates
      // the Keycloak flow transparently.
      const errorCode = err?.response?.data?.error ?? 'unknown';
      this.logger.warn(
        `Code exchange failed (${errorCode}) — redirecting to frontend for re-auth`,
      );
      res.redirect(`${process.env.FRONT_END_BASE_URL}${redirectTo}`);
      return;
    }

    this.logger.log(`Login completed, redirecting to frontend: ${redirectTo}`);
    res.redirect(`${process.env.FRONT_END_BASE_URL}${redirectTo}`);
    return;
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
    this.logger.log('Access token refreshed successfully');

    this.auth.setAccessCookie(res, tokens.access_token, req);
    return { ok: true };
  }

  @Post('logout')
  @Public()
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.logger.log('Logout requested');

    const hasRefreshToken = !!req.cookies?.REFRESH_TOKEN;
    this.logger.log(`Refresh token present during logout: ${hasRefreshToken}`);

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
  async me(@Req() req: any) {
    const authUser = req.user;

    if (!authUser?.id) {
      throw new UnauthorizedException('Unauthenticated');
    }

    this.logger.log(`[ME] authUserId=${authUser.id}`);

    return this.auth.getMe(authUser);
  }

  @Post('preferences')
  async updatePreferences(@Req() req: any) {
    const authUser = req.user;
    if (!authUser?.id) {
      throw new UnauthorizedException('Unauthenticated');
    }
    return this.auth.updatePreferences(authUser.id, req.body);
  }
}
