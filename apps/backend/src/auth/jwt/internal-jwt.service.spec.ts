import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InternalJwtService } from './internal-jwt.service';

const TEST_SECRET = 'a-secret-that-is-at-least-32-characters-long';

function makeService() {
  const jwtService = new JwtService({});
  process.env.JWT_SECRET = TEST_SECRET;
  return new InternalJwtService(jwtService);
}

describe('InternalJwtService', () => {
  let svc: InternalJwtService;

  beforeEach(() => {
    svc = makeService();
  });

  afterEach(() => {
    delete process.env.JWT_SECRET;
  });

  describe('signAccessToken / verifyAccessToken', () => {
    it('round-trips the access token', () => {
      const token = svc.signAccessToken({
        sub: 'user-1',
        email: 'test@example.com',
        permissions: ['orders:view'],
        tokenVersion: 0,
      });

      const decoded = svc.verifyAccessToken(token);

      expect(decoded.sub).toBe('user-1');
      expect(decoded.email).toBe('test@example.com');
      expect(decoded.permissions).toEqual(['orders:view']);
      expect(decoded.tokenVersion).toBe(0);
      expect(decoded.iss).toBe('skyprints');
      expect(decoded.aud).toBe('skyprints-api');
    });

    it('throws UnauthorizedException for a tampered token', () => {
      const token = svc.signAccessToken({ sub: 'u', email: 'e', permissions: [], tokenVersion: 0 });
      const tampered = token.slice(0, -4) + 'XXXX';
      expect(() => svc.verifyAccessToken(tampered)).toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when signed with wrong secret', () => {
      const otherSvc = new InternalJwtService(new JwtService({}));
      process.env.JWT_SECRET = 'some-other-secret-that-is-long-enough-ok';
      const tokenOther = otherSvc.signAccessToken({ sub: 'u', email: 'e', permissions: [], tokenVersion: 0 });

      process.env.JWT_SECRET = TEST_SECRET;
      expect(() => svc.verifyAccessToken(tokenOther)).toThrow(UnauthorizedException);
    });
  });

  describe('signRefreshToken / verifyRefreshToken', () => {
    it('round-trips the refresh token', () => {
      const token = svc.signRefreshToken({ sub: 'user-2', tokenVersion: 3 });
      const decoded = svc.verifyRefreshToken(token);

      expect(decoded.sub).toBe('user-2');
      expect(decoded.tokenVersion).toBe(3);
      expect(decoded.iss).toBe('skyprints');
      expect(decoded.aud).toBe('skyprints-api');
    });

    it('throws UnauthorizedException for an expired token', async () => {
      const jwtService = new JwtService({});
      const expiredToken = jwtService.sign(
        { sub: 'u', tokenVersion: 0, iss: 'skyprints', aud: 'skyprints-api' },
        { secret: TEST_SECRET, expiresIn: '-1s' },
      );
      expect(() => svc.verifyRefreshToken(expiredToken)).toThrow(UnauthorizedException);
    });

    it('honors an expiresIn override (rememberMe=false short session)', () => {
      const token = svc.signRefreshToken({ sub: 'user-3', tokenVersion: 0 }, '-1s');
      expect(() => svc.verifyRefreshToken(token)).toThrow(UnauthorizedException);
    });
  });
});
