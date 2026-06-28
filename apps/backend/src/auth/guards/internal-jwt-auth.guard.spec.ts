import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { InternalJwtService } from '../jwt/internal-jwt.service';
import { InternalJwtAuthGuard } from './internal-jwt-auth.guard';

const mockDecoded = {
  sub: 'user-abc',
  email: 'user@example.com',
  permissions: ['orders:view', 'runs:view'],
  tokenVersion: 1,
  iss: 'skyprints',
  aud: 'skyprints-api',
};

function makeCtx(req: Record<string, any>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

describe('InternalJwtAuthGuard', () => {
  let guard: InternalJwtAuthGuard;
  let jwtSvc: jest.Mocked<InternalJwtService>;

  beforeEach(() => {
    jwtSvc = { verifyAccessToken: jest.fn() } as any;
    guard = new InternalJwtAuthGuard(jwtSvc);
  });

  it('authenticates via cookie and attaches user', async () => {
    jwtSvc.verifyAccessToken.mockReturnValue(mockDecoded);
    const req: any = { cookies: { ACCESS_TOKEN: 'tok' }, headers: {} };

    const result = await guard.canActivate(makeCtx(req));

    expect(result).toBe(true);
    expect(req.user).toMatchObject({
      id: 'user-abc',
      email: 'user@example.com',
      permissions: ['orders:view', 'runs:view'],
      roles: [],
    });
    expect(jwtSvc.verifyAccessToken).toHaveBeenCalledWith('tok');
  });

  it('authenticates via Authorization Bearer header', async () => {
    jwtSvc.verifyAccessToken.mockReturnValue(mockDecoded);
    const req: any = { cookies: {}, headers: { authorization: 'Bearer hdr-token' } };

    await guard.canActivate(makeCtx(req));

    expect(jwtSvc.verifyAccessToken).toHaveBeenCalledWith('hdr-token');
  });

  it('prefers cookie over Authorization header', async () => {
    jwtSvc.verifyAccessToken.mockReturnValue(mockDecoded);
    const req: any = { cookies: { ACCESS_TOKEN: 'cookie-tok' }, headers: { authorization: 'Bearer hdr-tok' } };

    await guard.canActivate(makeCtx(req));

    expect(jwtSvc.verifyAccessToken).toHaveBeenCalledWith('cookie-tok');
  });

  it('throws UnauthorizedException when no token present', () => {
    const req: any = { cookies: {}, headers: {} };
    expect(() => guard.canActivate(makeCtx(req))).toThrow(UnauthorizedException);
  });

  it('propagates UnauthorizedException from verifyAccessToken', () => {
    jwtSvc.verifyAccessToken.mockImplementation(() => { throw new UnauthorizedException('bad'); });
    const req: any = { cookies: { ACCESS_TOKEN: 'bad-tok' }, headers: {} };
    expect(() => guard.canActivate(makeCtx(req))).toThrow(UnauthorizedException);
  });

  it('ignores non-Bearer Authorization schemes', () => {
    const req: any = { cookies: {}, headers: { authorization: 'Basic dXNlcjpwYXNz' } };
    expect(() => guard.canActivate(makeCtx(req))).toThrow(UnauthorizedException);
  });
});
