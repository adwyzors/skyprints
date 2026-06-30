import {
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { InternalJwtService } from './jwt/internal-jwt.service';
import { AuthService } from './auth.service';

jest.mock('bcrypt');
const bcryptCompare = bcrypt.compare as jest.Mock;

const mockPrisma = {
  user: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  login: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  transaction: jest.fn(),
} as unknown as jest.Mocked<PrismaService>;

const mockInternalJwt: jest.Mocked<InternalJwtService> = {
  signAccessToken: jest.fn().mockReturnValue('access-token'),
  signRefreshToken: jest.fn().mockReturnValue('refresh-token'),
  verifyAccessToken: jest.fn(),
  verifyRefreshToken: jest.fn(),
} as any;

const mockRes: any = {
  cookie: jest.fn(),
  clearCookie: jest.fn(),
};

const mockReq: any = {
  headers: {},
  hostname: 'localhost',
  secure: false,
};

function makeService() {
  return new AuthService(mockPrisma, mockInternalJwt);
}

describe('AuthService', () => {
  let svc: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    svc = makeService();
  });

  // ─── login ────────────────────────────────────────────────────────────────

  describe('login', () => {
    const activeUser = { id: 'u1', email: 'a@b.com', isActive: true, deletedAt: null };
    // loginRecord as returned by login.findFirst/findUnique with include: { user: true }
    const activeLoginRecord = {
      isActive: true,
      passwordHash: '$2b$10$hash',
      permissions: ['orders:view'],
      tokenVersion: 0,
      failedLoginAttempts: 0,
      user: activeUser,
    };

    beforeEach(() => {
      process.env.INTERNAL_AUTH_ENABLED = 'true';
      // Default: username lookup misses; email lookup misses
      (mockPrisma.login.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.user.findFirst as jest.Mock).mockResolvedValue(null);
    });

    afterEach(() => {
      delete process.env.INTERNAL_AUTH_ENABLED;
    });

    it('throws ServiceUnavailableException when flag is off', async () => {
      process.env.INTERNAL_AUTH_ENABLED = 'false';
      await expect(svc.login('a@b.com', 'pass', mockRes, mockReq)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('throws UnauthorizedException for unknown identifier', async () => {
      // login.findFirst → null (no username match), user.findFirst → null (no email match)
      await expect(svc.login('x@y.com', 'pass', mockRes, mockReq)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when User.isActive=false', async () => {
      // Username path: loginRecord.user.isActive is false
      (mockPrisma.login.findFirst as jest.Mock).mockResolvedValue({
        ...activeLoginRecord,
        user: { ...activeUser, isActive: false },
      });
      await expect(svc.login('a@b.com', 'pass', mockRes, mockReq)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when no Login record exists (email fallback)', async () => {
      // login.findFirst → null; user.findFirst finds a user; login.findUnique → null
      (mockPrisma.user.findFirst as jest.Mock).mockResolvedValue(activeUser);
      (mockPrisma.login.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(svc.login('a@b.com', 'pass', mockRes, mockReq)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when Login.isActive=false', async () => {
      (mockPrisma.login.findFirst as jest.Mock).mockResolvedValue({
        ...activeLoginRecord,
        isActive: false,
      });
      await expect(svc.login('a@b.com', 'pass', mockRes, mockReq)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('increments failedLoginAttempts on wrong password', async () => {
      (mockPrisma.login.findFirst as jest.Mock).mockResolvedValue(activeLoginRecord);
      bcryptCompare.mockResolvedValue(false);

      await expect(svc.login('a@b.com', 'wrong', mockRes, mockReq)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(mockPrisma.login.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ failedLoginAttempts: { increment: 1 } }) }),
      );
    });

    it('sets cookies and returns on successful login', async () => {
      (mockPrisma.login.findFirst as jest.Mock).mockResolvedValue(activeLoginRecord);
      bcryptCompare.mockResolvedValue(true);
      (mockPrisma.login.update as jest.Mock).mockResolvedValue({});

      await svc.login('a@b.com', 'correct', mockRes, mockReq);

      expect(mockInternalJwt.signAccessToken).toHaveBeenCalledWith(
        expect.objectContaining({ sub: 'u1', email: 'a@b.com' }),
      );
      expect(mockInternalJwt.signRefreshToken).toHaveBeenCalled();
      expect(mockRes.cookie).toHaveBeenCalled();
    });
  });

  // ─── refreshInternal ──────────────────────────────────────────────────────

  describe('refreshInternal', () => {
    const decoded = { sub: 'u1', tokenVersion: 2, iss: 'skyprints', aud: 'skyprints-api' };

    it('throws when token is invalid', async () => {
      mockInternalJwt.verifyRefreshToken.mockImplementation(() => { throw new UnauthorizedException(); });
      await expect(svc.refreshInternal('bad', mockRes, mockReq)).rejects.toThrow(UnauthorizedException);
    });

    it('throws when Login not found', async () => {
      mockInternalJwt.verifyRefreshToken.mockReturnValue(decoded);
      (mockPrisma.login.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(svc.refreshInternal('tok', mockRes, mockReq)).rejects.toThrow(UnauthorizedException);
    });

    it('throws when Login.isActive=false', async () => {
      mockInternalJwt.verifyRefreshToken.mockReturnValue(decoded);
      (mockPrisma.login.findUnique as jest.Mock).mockResolvedValue({
        isActive: false, tokenVersion: 2, permissions: [], user: { email: 'a@b.com', isActive: true },
      });
      await expect(svc.refreshInternal('tok', mockRes, mockReq)).rejects.toThrow(UnauthorizedException);
    });

    it('throws when tokenVersion mismatches', async () => {
      mockInternalJwt.verifyRefreshToken.mockReturnValue(decoded);
      (mockPrisma.login.findUnique as jest.Mock).mockResolvedValue({
        isActive: true, tokenVersion: 99, permissions: [], user: { email: 'a@b.com', isActive: true },
      });
      await expect(svc.refreshInternal('tok', mockRes, mockReq)).rejects.toThrow(UnauthorizedException);
    });

    it('issues new access token on valid refresh', async () => {
      mockInternalJwt.verifyRefreshToken.mockReturnValue(decoded);
      (mockPrisma.login.findUnique as jest.Mock).mockResolvedValue({
        isActive: true, tokenVersion: 2, permissions: ['orders:view'], user: { email: 'a@b.com', isActive: true },
      });

      await svc.refreshInternal('tok', mockRes, mockReq);

      expect(mockInternalJwt.signAccessToken).toHaveBeenCalledWith(
        expect.objectContaining({ sub: 'u1', tokenVersion: 2, permissions: ['orders:view'] }),
      );
      expect(mockRes.cookie).toHaveBeenCalled();
    });
  });

  // ─── logoutInternal ───────────────────────────────────────────────────────

  describe('logoutInternal', () => {
    it('increments tokenVersion and clears cookies', async () => {
      (mockPrisma.login.update as jest.Mock).mockResolvedValue({});

      await svc.logoutInternal('u1', mockRes, mockReq);

      expect(mockPrisma.login.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { tokenVersion: { increment: 1 } }, where: { userId: 'u1' } }),
      );
      expect(mockRes.clearCookie).toHaveBeenCalled();
    });
  });

  // ─── revokeSession ────────────────────────────────────────────────────────

  describe('revokeSession', () => {
    it('increments tokenVersion without touching cookies', async () => {
      (mockPrisma.login.update as jest.Mock).mockResolvedValue({});

      await svc.revokeSession('u2');

      expect(mockPrisma.login.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'u2' }, data: { tokenVersion: { increment: 1 } } }),
      );
    });
  });
});
