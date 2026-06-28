import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { StringValue } from 'ms';
import { ContextLogger } from '../../common/logger/context.logger';

const ISS = 'skyprints';
const AUD = 'skyprints-api';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  permissions: string[];
  tokenVersion: number;
  iss: string;
  aud: string;
}

export interface RefreshTokenPayload {
  sub: string;
  tokenVersion: number;
  iss: string;
  aud: string;
}

@Injectable()
export class InternalJwtService {
  private readonly logger = new ContextLogger(InternalJwtService.name);

  constructor(private readonly jwt: JwtService) {}

  signAccessToken(payload: {
    sub: string;
    email: string;
    permissions: string[];
    tokenVersion: number;
  }): string {
    return this.jwt.sign(
      { ...payload, iss: ISS, aud: AUD },
      {
        secret: process.env.JWT_SECRET,
        expiresIn: (process.env.JWT_ACCESS_EXPIRES ?? '15m') as StringValue,
      },
    );
  }

  signRefreshToken(payload: { sub: string; tokenVersion: number }): string {
    return this.jwt.sign(
      { ...payload, iss: ISS, aud: AUD },
      {
        secret: process.env.JWT_SECRET,
        expiresIn: (process.env.JWT_REFRESH_EXPIRES ?? '7d') as StringValue,
      },
    );
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    try {
      const decoded = this.jwt.verify<AccessTokenPayload>(token, {
        secret: process.env.JWT_SECRET,
        issuer: ISS,
        audience: AUD,
      });
      return decoded;
    } catch (err: any) {
      this.logger.warn(`Access token verification failed: ${err?.message}`);
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }

  verifyRefreshToken(token: string): RefreshTokenPayload {
    try {
      const decoded = this.jwt.verify<RefreshTokenPayload>(token, {
        secret: process.env.JWT_SECRET,
        issuer: ISS,
        audience: AUD,
      });
      return decoded;
    } catch (err: any) {
      this.logger.warn(`Refresh token verification failed: ${err?.message}`);
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }
}
