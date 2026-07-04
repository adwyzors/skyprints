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
import { cookieOptions, getCookieName } from './utils/cookie-domain.util';

interface LoginBody {
  username: string;
  password: string;
  rememberMe?: boolean;
  loginIndex?: string | number;
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
    @Query('loginIndex') loginIndex = '0',
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.logger.log(`Login requested from ${req.ip}, redirectTo=${redirectTo}, loginIndex=${loginIndex}`);

    // Store nonce in short-lived cookie to prevent CSRF on callback
    const nonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
    res.cookie('OAUTH_NONCE', nonce, {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE !== 'false',
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000,
      path: '/',
    });

    const state = Buffer.from(JSON.stringify({ redirectTo, nonce, loginIndex })).toString(
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
    let loginIndex: string = '0';

    if (state) {
      try {
        const parsed = JSON.parse(Buffer.from(state, 'base64').toString());
        redirectTo = safeRedirect(parsed.redirectTo ?? '/');
        nonce = parsed.nonce;
        loginIndex = parsed.loginIndex ?? '0';
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
      this.auth.setAuthCookies(res, tokens, req, true, loginIndex);
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
    const { username, password, rememberMe = true, loginIndex = 0 } = body ?? {};

    if (!username || !password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.auth.login(username, password, res, req, rememberMe, loginIndex);
    return { ok: true };
  }

  @Post('refresh')
  @Public()
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const activeIndex = req.cookies?.active_account_index || '0';
    const refreshCookieName = getCookieName('REFRESH_TOKEN', activeIndex);
    const hasRefreshToken = !!req.cookies?.[refreshCookieName];

    this.logger.log(
      `Refresh requested for index ${activeIndex} (refreshTokenPresent=${hasRefreshToken})`,
    );

    if (!hasRefreshToken) {
      this.logger.warn(`Refresh denied: no refresh token cookie for index ${activeIndex}`);
      throw new UnauthorizedException();
    }

    const useInternal = process.env.INTERNAL_AUTH_ENABLED === 'true';

    if (useInternal) {
      await this.auth.refreshInternal(req.cookies[refreshCookieName], res, req, activeIndex);
    } else {
      const tokens = await this.keycloak.refresh(req.cookies[refreshCookieName]);
      this.logger.log(`Access token refreshed successfully via Keycloak for index ${activeIndex}`);
      this.auth.setAccessCookie(res, tokens.access_token, req, activeIndex);
    }

    return { ok: true };
  }

  @Post('logout')
  @Public()
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.logger.log('Logout requested');
    const activeIndex = req.cookies?.active_account_index || '0';
    const useInternal = process.env.INTERNAL_AUTH_ENABLED === 'true';

    if (useInternal) {
      let userId: string | undefined;
      const activeAccessTokenName = getCookieName('ACCESS_TOKEN', activeIndex);
      const token = req.cookies?.[activeAccessTokenName];
      if (token) {
        try {
          const decoded = this.auth.verifyAccessToken(token);
          userId = decoded.sub;
        } catch {}
      }

      if (userId) {
        await this.auth.logoutInternal(userId, res, req, activeIndex);
      } else {
        this.auth.clearCookiesAtIndex(res, req, activeIndex);
      }
    } else {
      const activeRefreshTokenName = getCookieName('REFRESH_TOKEN', activeIndex);
      const rToken = req.cookies?.[activeRefreshTokenName];
      this.logger.log(
        `Refresh token present during logout for index ${activeIndex}: ${!!rToken}`,
      );

      if (rToken) {
        try {
          await this.keycloak.keycloakLogout(rToken);
          this.logger.log('Keycloak SSO session terminated');
        } catch {
          this.logger.warn('Keycloak logout failed (continuing app logout)');
        }
      }

      this.auth.clearCookiesAtIndex(res, req, activeIndex);
      this.logger.log(`Application auth cookies cleared for index ${activeIndex}`);
    }

    // Switch active index to another logged-in profile if one exists
    const remainingProfiles = await this.auth.getProfilesFromCookies(req);
    const leftOver = remainingProfiles.filter(p => String(p.index) !== String(activeIndex));
    if (leftOver.length > 0) {
      res.cookie('active_account_index', String(leftOver[0].index), {
        ...cookieOptions(req, 7 * 24 * 60 * 60),
        httpOnly: false,
      });
    } else {
      res.clearCookie('active_account_index', cookieOptions(req, 0));
    }

    return { success: true };
  }

  @Post('logout-all')
  @Public()
  async logoutAll(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.logger.log('Logout all requested');
    const useInternal = process.env.INTERNAL_AUTH_ENABLED === 'true';

    if (useInternal) {
      for (let i = 0; i < 5; i++) {
        const tokenName = getCookieName('ACCESS_TOKEN', i);
        const token = req.cookies?.[tokenName];
        if (token) {
          try {
            const decoded = this.auth.verifyAccessToken(token);
            await this.auth.revokeSession(decoded.sub);
          } catch {}
        }
      }
    } else {
      for (let i = 0; i < 5; i++) {
        const tokenName = getCookieName('REFRESH_TOKEN', i);
        const rToken = req.cookies?.[tokenName];
        if (rToken) {
          try {
            await this.keycloak.keycloakLogout(rToken);
          } catch {}
        }
      }
    }

    this.auth.clearAllCookies(res, req);
    return { success: true };
  }

  @Get('profiles')
  @Public()
  async getProfiles(@Req() req: Request) {
    return this.auth.getProfilesFromCookies(req);
  }

  @Post('switch')
  @Public()
  async switchAccount(
    @Body('index') index: number | string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.logger.log(`Switching active profile index to ${index}`);
    res.cookie('active_account_index', String(index), {
      ...cookieOptions(req, 7 * 24 * 60 * 60),
      httpOnly: false,
    });
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
