import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UpdatePreferencesSchema } from '@app/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import type { Request, Response } from 'express';
import { ContextLogger } from '../common/logger/context.logger';
import { InternalJwtService } from './jwt/internal-jwt.service';
import { cookieOptions, getCookieName } from './utils/cookie-domain.util';

@Injectable()
export class AuthService {
  private readonly logger = new ContextLogger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly internalJwt: InternalJwtService,
  ) {}

  setAuthCookies(res: Response, tokens: any, req: Request, rememberMe = true, loginIndex: number | string = 0) {
    this.setAccessCookie(res, tokens.access_token, req, loginIndex);

    // rememberMe=false -> session cookie, cleared when the browser closes
    const refreshMaxAge = rememberMe ? 7 * 24 * 60 * 60 : undefined;
    const cookieName = getCookieName('REFRESH_TOKEN', loginIndex);
    res.cookie(
      cookieName,
      tokens.refresh_token,
      cookieOptions(req, refreshMaxAge),
    );

    // Set client-readable active_account_index cookie
    res.cookie('active_account_index', String(loginIndex), {
      ...cookieOptions(req, refreshMaxAge),
      httpOnly: false,
    });

    this.logger.log(`Auth cookies set for index ${loginIndex} (rememberMe=${rememberMe})`);
  }

  setAccessCookie(res: Response, token: string, req: Request, loginIndex: number | string = 0) {
    const cookieName = getCookieName('ACCESS_TOKEN', loginIndex);
    res.cookie(cookieName, token, cookieOptions(req, 15 * 60));
  }

  clearCookies(res: Response, req: Request) {
    this.clearCookiesAtIndex(res, req, 0);
  }

  clearCookiesAtIndex(res: Response, req: Request, index: number | string = 0) {
    const options = cookieOptions(req, 0);
    res.clearCookie(getCookieName('ACCESS_TOKEN', index), options);
    res.clearCookie(getCookieName('REFRESH_TOKEN', index), options);
    this.logger.log(`Auth cookies cleared for index ${index}`);
  }

  clearAllCookies(res: Response, req: Request) {
    const options = cookieOptions(req, 0);
    res.clearCookie('active_account_index', options);
    for (let i = 0; i < 5; i++) {
      res.clearCookie(getCookieName('ACCESS_TOKEN', i), options);
      res.clearCookie(getCookieName('REFRESH_TOKEN', i), options);
    }
    this.logger.log('All auth cookies cleared');
  }

  async getProfilesFromCookies(req: Request) {
    const profiles = [];
    for (let i = 0; i < 5; i++) {
      const cookieName = getCookieName('ACCESS_TOKEN', i);
      const token = req.cookies?.[cookieName];
      if (token) {
        try {
          const decoded = this.internalJwt.decodeToken(token);
          const userId = decoded?.sub || null;

          if (userId) {
            const dbUser = await this.prisma.user.findFirst({
              where: { id: userId, deletedAt: null, isActive: true },
              select: {
                id: true,
                email: true,
                name: true,
                role: true,
              },
            });

            if (dbUser) {
              profiles.push({
                index: i,
                user: dbUser,
              });
            }
          }
        } catch (e: any) {
          this.logger.error(`Error decoding token for profile index ${i}: ${e.message}`);
        }
      }
    }
    return profiles;
  }

  async login(
    identifier: string,
    password: string,
    res: Response,
    req: Request,
    rememberMe = true,
    loginIndex: number | string = 0,
  ): Promise<void> {
    if (process.env.INTERNAL_AUTH_ENABLED !== 'true') {
      throw new ServiceUnavailableException(
        'Internal auth is not enabled. Use Keycloak login.',
      );
    }

    // 1. Look up login record by username first, then fall back to user email
    let loginRecord = await this.prisma.login.findFirst({
      where: {
        username: identifier,
        user: { deletedAt: null },
      },
      include: { user: true },
    });

    if (!loginRecord) {
      const user = await this.prisma.user.findFirst({
        where: { email: identifier, deletedAt: null },
      });
      if (user) {
        loginRecord = (await this.prisma.login.findUnique({
          where: { userId: user.id },
          include: { user: true },
        })) as any;
      }
    }

    if (!loginRecord) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const user = loginRecord.user;

    // 2. Check User.isActive
    if (!user.isActive) {
      throw new UnauthorizedException(
        'Account disabled. Contact administrator.',
      );
    }

    // 4. Check Login.isActive
    if (!loginRecord.isActive) {
      throw new UnauthorizedException(
        'Login temporarily disabled. Contact administrator.',
      );
    }

    // 5. bcrypt.compare — on fail: audit trail, throw generic error
    const passwordMatch = await bcrypt.compare(
      password,
      loginRecord.passwordHash,
    );
    if (!passwordMatch) {
      await this.prisma.login.update({
        where: { userId: user.id },
        data: {
          failedLoginAttempts: { increment: 1 },
          lastFailedLoginAt: new Date(),
        },
      });
      this.logger.warn(`Failed login attempt for userId=${user.id}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    // 6. Success: reset audit trail
    await this.prisma.login.update({
      where: { userId: user.id },
      data: {
        failedLoginAttempts: 0,
        lastLoginAt: new Date(),
      },
    });

    // 7. Sign both JWTs
    const accessToken = this.internalJwt.signAccessToken({
      sub: user.id,
      email: user.email,
      permissions: loginRecord.permissions,
      tokenVersion: loginRecord.tokenVersion,
      locationId: user.locationId,
    });
    const refreshExpiresIn = rememberMe
      ? (process.env.JWT_REFRESH_EXPIRES ?? '7d')
      : (process.env.JWT_REFRESH_EXPIRES_SHORT ?? '1d');
    const refreshToken = this.internalJwt.signRefreshToken(
      { sub: user.id, tokenVersion: loginRecord.tokenVersion },
      refreshExpiresIn,
    );

    // 8. Set cookies
    this.setAuthCookies(
      res,
      { access_token: accessToken, refresh_token: refreshToken },
      req,
      rememberMe,
      loginIndex,
    );

    this.logger.log(
      `Internal login succeeded for userId=${user.id} (rememberMe=${rememberMe})`,
    );
  }

  async refreshInternal(
    refreshToken: string,
    res: Response,
    req: Request,
    loginIndex: number | string = 0,
  ): Promise<void> {
    // 1. Verify token signature + iss/aud
    const decoded = this.internalJwt.verifyRefreshToken(refreshToken);

    // 2. Load Login from DB
    const loginRecord = await this.prisma.login.findUnique({
      where: { userId: decoded.sub },
      include: {
        user: { select: { isActive: true, email: true, locationId: true } },
      },
    });

    if (!loginRecord) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // 3. Check Login.isActive (covers soft-deleted users)
    if (!loginRecord.isActive) {
      throw new UnauthorizedException('Session has been revoked');
    }

    // 4. TokenVersion check — must match what's in the token
    if (decoded.tokenVersion !== loginRecord.tokenVersion) {
      throw new UnauthorizedException('Session has been revoked');
    }

    // 5. Issue new ACCESS_TOKEN with fresh permissions from DB
    const newAccessToken = this.internalJwt.signAccessToken({
      sub: decoded.sub,
      email: loginRecord.user?.email ?? '',
      permissions: loginRecord.permissions,
      tokenVersion: loginRecord.tokenVersion,
      locationId: loginRecord.user?.locationId ?? null,
    });

    this.setAccessCookie(res, newAccessToken, req, loginIndex);
    this.logger.log(`Token refreshed for userId=${decoded.sub}`);
  }

  async logoutInternal(
    userId: string,
    res: Response,
    req: Request,
    loginIndex: number | string = 0,
  ): Promise<void> {
    // Increment tokenVersion to invalidate all outstanding refresh tokens
    await this.prisma.login.update({
      where: { userId },
      data: { tokenVersion: { increment: 1 } },
    });

    this.clearCookiesAtIndex(res, req, loginIndex);
    this.logger.log(`Internal logout for userId=${userId}`);
  }

  async revokeSession(userId: string): Promise<void> {
    await this.prisma.login.update({
      where: { userId },
      data: { tokenVersion: { increment: 1 } },
    });
    this.logger.log(`Session revoked for userId=${userId}`);
  }

  verifyAccessToken(token: string) {
    return this.internalJwt.verifyAccessToken(token);
  }


  async getMe(authUser: any) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: authUser.id,
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        preferences: true,
        location: {
          select: {
            id: true,
            code: true,
            name: true,
            type: true,
          },
        },
      },
    });

    if (!user) {
      throw new ForbiddenException('User is inactive or deleted');
    }

    if (user.preferences && typeof user.preferences === 'object') {
      const filteredPreferences: Record<string, any> = {};
      for (const [key, value] of Object.entries(user.preferences as object)) {
        if (value === true) {
          filteredPreferences[key] = true;
        }
      }
      user.preferences = filteredPreferences as any;
    }

    return {
      id: authUser.id,
      alternateEmail: authUser.email,
      permissions: authUser.permissions ?? [],
      user,
    };
  }

  async updatePreferences(userId: string, body: unknown) {
    const parsed = UpdatePreferencesSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException('Invalid preferences');
    }
    const preferences = parsed.data;

    const currentUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { preferences: true },
    });
    const existingPrefs =
      (currentUser?.preferences as Record<string, any>) || {};
    const newPrefs = { ...existingPrefs, ...preferences };

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { preferences: newPrefs },
    });

    if (user.preferences && typeof user.preferences === 'object') {
      const filteredPreferences: Record<string, any> = {};
      for (const [key, value] of Object.entries(user.preferences as object)) {
        if (value === true) {
          filteredPreferences[key] = true;
        }
      }
      return filteredPreferences;
    }

    return user.preferences;
  }
}
