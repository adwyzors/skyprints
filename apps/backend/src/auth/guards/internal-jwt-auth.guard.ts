import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { RequestContextStore } from '../../common/context/request-context.store';
import { ContextLogger } from '../../common/logger/context.logger';
import { InternalJwtService } from '../jwt/internal-jwt.service';

@Injectable()
export class InternalJwtAuthGuard implements CanActivate {
  private readonly logger = new ContextLogger(InternalJwtAuthGuard.name);

  constructor(private readonly internalJwt: InternalJwtService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const token = this.extractToken(req);

    if (!token) {
      this.logger.log('Internal JWT token missing');
      throw new UnauthorizedException('Missing access token');
    }

    const decoded = this.internalJwt.verifyAccessToken(token);

    const user = {
      id: decoded.sub,
      email: decoded.email,
      permissions: decoded.permissions ?? [],
      roles: [] as string[],
      locationId: decoded.locationId ?? null,
    };

    req.user = user;

    const store = RequestContextStore.getStore();
    if (store) {
      store.user = user;
    }

    return true;
  }

  private extractToken(req: any): string | null {
    if (req.cookies?.ACCESS_TOKEN) {
      return req.cookies.ACCESS_TOKEN;
    }

    const auth = req.headers?.authorization;
    if (!auth) return null;

    const [type, token] = auth.split(' ');
    return type === 'Bearer' ? token : null;
  }
}
