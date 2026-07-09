import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { KeycloakService } from './keycloak/keycloak.service';

function makeReq(cookies: Record<string, string>): any {
  return { cookies };
}

function makeRes(): any {
  return { cookie: jest.fn(), clearCookie: jest.fn(), redirect: jest.fn() };
}

describe('AuthController', () => {
  let authMock: jest.Mocked<AuthService>;
  let keycloakMock: jest.Mocked<KeycloakService>;
  let controller: AuthController;

  beforeEach(() => {
    process.env.INTERNAL_AUTH_ENABLED = 'true';

    authMock = {
      verifyAccessToken: jest.fn(),
      logoutInternal: jest.fn().mockResolvedValue(undefined),
      clearCookiesAtIndex: jest.fn(),
      clearAllCookies: jest.fn(),
      getProfilesFromCookies: jest.fn().mockResolvedValue([]),
      refreshInternal: jest.fn(),
      revokeSessionForTokens: jest.fn().mockResolvedValue(undefined),
    } as any;
    keycloakMock = {} as any;

    controller = new AuthController(authMock, keycloakMock);
  });

  afterEach(() => {
    delete process.env.INTERNAL_AUTH_ENABLED;
  });

  describe('logout', () => {
    it('keeps active_account_index pointed at another account whose access token has expired but whose refresh token is still valid', async () => {
      const req = makeReq({ active_account_index: '0', ACCESS_TOKEN: 'token-0' });
      const res = makeRes();

      authMock.verifyAccessToken.mockReturnValue({ sub: 'user-0' } as any);
      // account 1 has no ACCESS_TOKEN_1 (expired) but is still a live session —
      // AuthService.getProfilesFromCookies must report it via its refresh token.
      authMock.getProfilesFromCookies.mockResolvedValue([
        { index: 1, user: { id: 'user-1', email: 'b@b.com', name: 'B', role: 'ADMIN' } },
      ]);

      await controller.logout(req, res);

      expect(authMock.logoutInternal).toHaveBeenCalledWith('user-0', res, req, '0');
      expect(res.cookie).toHaveBeenCalledWith('active_account_index', '1', expect.any(Object));
      expect(res.clearCookie).not.toHaveBeenCalledWith(
        'active_account_index',
        expect.any(Object),
      );
    });

    it('clears active_account_index only when no other session remains at all', async () => {
      const req = makeReq({ active_account_index: '0', ACCESS_TOKEN: 'token-0' });
      const res = makeRes();

      authMock.verifyAccessToken.mockReturnValue({ sub: 'user-0' } as any);
      authMock.getProfilesFromCookies.mockResolvedValue([]);

      await controller.logout(req, res);

      expect(res.clearCookie).toHaveBeenCalledWith('active_account_index', expect.any(Object));
      expect(res.cookie).not.toHaveBeenCalledWith(
        'active_account_index',
        expect.anything(),
        expect.anything(),
      );
    });

    it('does not treat the account being logged out as its own leftover profile', async () => {
      const req = makeReq({ active_account_index: '0', ACCESS_TOKEN: 'token-0' });
      const res = makeRes();

      authMock.verifyAccessToken.mockReturnValue({ sub: 'user-0' } as any);
      // getProfilesFromCookies still reports index 0 itself (e.g. stale cookie
      // read before clearCookiesAtIndex took effect) — it must be filtered out.
      authMock.getProfilesFromCookies.mockResolvedValue([
        { index: 0, user: { id: 'user-0', email: 'a@b.com', name: 'A', role: 'ADMIN' } },
      ]);

      await controller.logout(req, res);

      expect(res.clearCookie).toHaveBeenCalledWith('active_account_index', expect.any(Object));
    });
  });

  describe('switchAccount', () => {
    it('rejects switching to an index with no live session', async () => {
      const req = makeReq({});
      const res = makeRes();

      authMock.getProfilesFromCookies.mockResolvedValue([
        { index: 0, user: { id: 'user-0', email: 'a@b.com', name: 'A', role: 'ADMIN' } },
      ]);

      await expect(controller.switchAccount(3, req, res)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(res.cookie).not.toHaveBeenCalled();
    });

    it('allows switching to an index that has a live session', async () => {
      const req = makeReq({});
      const res = makeRes();

      authMock.getProfilesFromCookies.mockResolvedValue([
        { index: 0, user: { id: 'user-0', email: 'a@b.com', name: 'A', role: 'ADMIN' } },
        { index: 1, user: { id: 'user-1', email: 'b@b.com', name: 'B', role: 'ADMIN' } },
      ]);

      await controller.switchAccount(1, req, res);

      expect(res.cookie).toHaveBeenCalledWith('active_account_index', '1', expect.any(Object));
    });
  });

  describe('logoutAll', () => {
    it('revokes every index with either an access or refresh token, then clears all cookies', async () => {
      const req = makeReq({
        ACCESS_TOKEN: 'access-0',
        REFRESH_TOKEN_1: 'refresh-1', // access token for account 1 already expired
      });
      const res = makeRes();

      await controller.logoutAll(req, res);

      expect(authMock.revokeSessionForTokens).toHaveBeenCalledWith('access-0', undefined);
      expect(authMock.revokeSessionForTokens).toHaveBeenCalledWith(undefined, 'refresh-1');
      expect(authMock.revokeSessionForTokens).toHaveBeenCalledTimes(2);
      expect(authMock.clearAllCookies).toHaveBeenCalledWith(res, req);
    });

    it('skips indices with no tokens at all', async () => {
      const req = makeReq({ ACCESS_TOKEN: 'access-0' });
      const res = makeRes();

      await controller.logoutAll(req, res);

      expect(authMock.revokeSessionForTokens).toHaveBeenCalledTimes(1);
      expect(authMock.clearAllCookies).toHaveBeenCalledWith(res, req);
    });
  });
});
