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
import { cookieOptions, getCookieName } from './utils/cookie-domain.util';

interface LoginBody {
  username: string;
  password: string;
  rememberMe?: boolean;
  loginIndex?: string | number;
}

@Controller('auth')
export class AuthController {
  private readonly logger = new ContextLogger(AuthController.name);

  constructor(private readonly auth: AuthService) {}

  @Get('health')
  @Public()
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Post('login')
  @Public()
  @HttpCode(200)
  async internalLogin(
    @Body() body: LoginBody,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const {
      username,
      password,
      rememberMe = true,
      loginIndex = 0,
    } = body ?? {};

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
      this.logger.warn(
        `Refresh denied: no refresh token cookie for index ${activeIndex}`,
      );
      throw new UnauthorizedException();
    }

    await this.auth.refreshInternal(
      req.cookies[refreshCookieName],
      res,
      req,
      activeIndex,
    );

    return { ok: true };
  }

  @Post('logout')
  @Public()
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.logger.log('Logout requested');
    const activeIndex = req.cookies?.active_account_index || '0';

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

    // Switch active index to another logged-in profile if one exists
    const remainingProfiles = await this.auth.getProfilesFromCookies(req);
    const leftOver = remainingProfiles.filter(
      (p) => String(p.index) !== String(activeIndex),
    );
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
  async logoutAll(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.logger.log('Logout all requested');

    for (let i = 0; i < 5; i++) {
      const accessToken = req.cookies?.[getCookieName('ACCESS_TOKEN', i)];
      const refreshToken = req.cookies?.[getCookieName('REFRESH_TOKEN', i)];
      if (accessToken || refreshToken) {
        await this.auth.revokeSessionForTokens(accessToken, refreshToken);
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

    const profiles = await this.auth.getProfilesFromCookies(req);
    const targetExists = profiles.some(
      (p) => String(p.index) === String(index),
    );
    if (!targetExists) {
      this.logger.warn(`Switch denied: no active session for index ${index}`);
      throw new UnauthorizedException('No active session for that account');
    }

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
