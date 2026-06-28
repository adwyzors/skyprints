import {
  Body,
  Controller,
  Get,
  HttpCode,
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

interface LoginBody {
  email: string;
  password: string;
}

const safeRedirect = (path: string): string =>
  path.startsWith('/') && !path.startsWith('//') ? path : '/';

@Controller('auth')
export class AuthController {
  private readonly logger = new ContextLogger(AuthController.name);

  constructor(
    private readonly auth: AuthService,
    private readonly keycloak: KeycloakService,
  ) {}

  @Get('health')
  @Public()
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('login')
  @Public()
  login(
    @Query('redirectTo') redirectTo = '/',
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.logger.log(`Login requested from ${req.ip}, redirectTo=${redirectTo}`);

    // Store nonce in short-lived cookie to prevent CSRF on callback
    const nonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
    res.cookie('OAUTH_NONCE', nonce, {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE !== 'false',
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000,
      path: '/',
    });

    const state = Buffer.from(JSON.stringify({ redirectTo, nonce })).toString(
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

    let redirectTo = '/';
    let nonce: string | undefined;

    if (state) {
      try {
        const parsed = JSON.parse(Buffer.from(state, 'base64').toString());
        redirectTo = safeRedirect(parsed.redirectTo ?? '/');
        nonce = parsed.nonce;
      } catch {
        this.logger.warn('Invalid OAuth state parameter');
      }
    }

    // Verify CSRF nonce
    const cookieNonce = req.cookies?.OAUTH_NONCE;
    if (!cookieNonce || cookieNonce !== nonce) {
      this.logger.warn('OAuth CSRF nonce mismatch — aborting callback');
      res.clearCookie('OAUTH_NONCE');
      res.redirect(`${process.env.FRONT_END_BASE_URL}/`);
      return;
    }

    res.clearCookie('OAUTH_NONCE');

    try {
      const tokens = await this.keycloak.exchangeCode(code);
      this.logger.log('Authorization code successfully exchanged');
      this.auth.setAuthCookies(res, tokens, req);
    } catch (err: any) {
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

  @Post('login')
  @Public()
  @HttpCode(200)
  async internalLogin(
    @Body() body: LoginBody,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { email, password } = body ?? {};

    if (!email || !password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.auth.login(email, password, res, req);
    return { ok: true };
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

    const useInternal = process.env.INTERNAL_AUTH_ENABLED === 'true';

    if (useInternal) {
      await this.auth.refreshInternal(req.cookies.REFRESH_TOKEN, res, req);
    } else {
      const tokens = await this.keycloak.refresh(req.cookies.REFRESH_TOKEN);
      this.logger.log('Access token refreshed successfully via Keycloak');
      this.auth.setAccessCookie(res, tokens.access_token, req);
    }

    return { ok: true };
  }

  @Post('logout')
  @Public()
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.logger.log('Logout requested');

    const useInternal = process.env.INTERNAL_AUTH_ENABLED === 'true';

    if (useInternal) {
      const authUser = (req as any).user;
      if (authUser?.id) {
        await this.auth.logoutInternal(authUser.id, res, req);
      } else {
        this.auth.clearCookies(res, req);
      }
    } else {
      const hasRefreshToken = !!req.cookies?.REFRESH_TOKEN;
      this.logger.log(
        `Refresh token present during logout: ${hasRefreshToken}`,
      );

      if (hasRefreshToken) {
        try {
          await this.keycloak.keycloakLogout(req.cookies.REFRESH_TOKEN);
          this.logger.log('Keycloak SSO session terminated');
        } catch {
          this.logger.warn('Keycloak logout failed (continuing app logout)');
        }
      }

      this.auth.clearCookies(res, req);
      this.logger.log('Application auth cookies cleared');
    }

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
