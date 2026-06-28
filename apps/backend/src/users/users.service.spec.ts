import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from 'apps/backend/prisma/prisma.service';
import { UsersService } from './users.service';

jest.mock('bcrypt');
const bcryptHash = bcrypt.hash as jest.Mock;
bcryptHash.mockResolvedValue('$2b$10$hashed');

const mockTx = {
  user: { create: jest.fn(), update: jest.fn() },
  login: { create: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
};

const mockPrisma = {
  user: { findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn() },
  login: {
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  location: { findUnique: jest.fn() },
  transaction: jest.fn((fn: (tx: any) => Promise<any>) => fn(mockTx)),
} as unknown as jest.Mocked<PrismaService>;

function makeService() {
  return new UsersService(mockPrisma);
}

describe('UsersService', () => {
  let svc: UsersService;

  beforeEach(() => {
    jest.clearAllMocks();
    svc = makeService();
  });

  // ─── list / findById ──────────────────────────────────────────────────────

  describe('list', () => {
    it('returns active users from prisma', async () => {
      (mockPrisma.user.findMany as jest.Mock).mockResolvedValue([{ id: 'u1' }]);
      const result = await svc.list();
      expect(result).toEqual([{ id: 'u1' }]);
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { deletedAt: null } }),
      );
    });
  });

  describe('findById', () => {
    it('throws NotFoundException for unknown id', async () => {
      (mockPrisma.user.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(svc.findById('missing')).rejects.toThrow(NotFoundException);
    });

    it('returns user when found', async () => {
      const user = { id: 'u1', name: 'Alice' };
      (mockPrisma.user.findFirst as jest.Mock).mockResolvedValue(user);
      await expect(svc.findById('u1')).resolves.toEqual(user);
    });
  });

  // ─── create ───────────────────────────────────────────────────────────────

  describe('create', () => {
    const dto = {
      name: 'Bob', email: 'bob@example.com', role: 'OPERATOR' as const,
      password: 'password123', locationId: undefined, permissions: undefined,
    };

    it('creates user + login inside a transaction', async () => {
      mockTx.user.create.mockResolvedValue({ id: 'new-id', ...dto });

      await svc.create(dto);

      expect(mockTx.user.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ email: 'bob@example.com', role: 'OPERATOR' }) }),
      );
      expect(mockTx.login.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ userId: 'new-id', passwordHash: '$2b$10$hashed' }) }),
      );
    });

    it('validates locationId when provided', async () => {
      (mockPrisma.location.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(svc.create({ ...dto, locationId: 'loc-1' })).rejects.toThrow(BadRequestException);
    });

    it('throws ConflictException on duplicate email (P2002)', async () => {
      mockTx.user.create.mockRejectedValue({ code: 'P2002' });
      await expect(svc.create(dto)).rejects.toThrow(ConflictException);
    });

    it('uses role defaults for permissions when none provided', async () => {
      mockTx.user.create.mockResolvedValue({ id: 'x' });

      await svc.create({ ...dto, role: 'OPERATOR', permissions: undefined });

      expect(mockTx.login.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            permissions: expect.arrayContaining(['runs:view']),
          }),
        }),
      );
    });
  });

  // ─── update ───────────────────────────────────────────────────────────────

  describe('update', () => {
    it('throws NotFoundException for unknown user', async () => {
      (mockPrisma.user.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(svc.update('missing', { name: 'X' })).rejects.toThrow(NotFoundException);
    });

    it('validates locationId when updating', async () => {
      (mockPrisma.user.findFirst as jest.Mock).mockResolvedValue({ id: 'u1' });
      (mockPrisma.location.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(svc.update('u1', { locationId: 'bad-loc' })).rejects.toThrow(BadRequestException);
    });

    it('allows setting locationId to null', async () => {
      (mockPrisma.user.findFirst as jest.Mock).mockResolvedValue({ id: 'u1' });
      (mockPrisma.user.update as jest.Mock).mockResolvedValue({ id: 'u1', locationId: null });

      await svc.update('u1', { locationId: null });

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { locationId: null } }),
      );
    });
  });

  // ─── updatePermissions ────────────────────────────────────────────────────

  describe('updatePermissions', () => {
    it('throws ForbiddenException when user tries to update own permissions', async () => {
      await expect(
        svc.updatePermissions('self', 'self', { permissions: ['orders:view'] }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException for unknown permission strings', async () => {
      await expect(
        svc.updatePermissions('admin', 'user', { permissions: ['invalid:permission'] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when target has no Login record', async () => {
      (mockPrisma.login.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(
        svc.updatePermissions('admin', 'user', { permissions: ['orders:view'] }),
      ).rejects.toThrow(NotFoundException);
    });

    it('increments tokenVersion on success', async () => {
      (mockPrisma.login.findUnique as jest.Mock).mockResolvedValue({ userId: 'user' });
      (mockPrisma.login.update as jest.Mock).mockResolvedValue({});

      await svc.updatePermissions('admin', 'user', { permissions: ['orders:view'] });

      expect(mockPrisma.login.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user' },
          data: expect.objectContaining({ tokenVersion: { increment: 1 } }),
        }),
      );
    });
  });

  // ─── softDelete ───────────────────────────────────────────────────────────

  describe('softDelete', () => {
    it('throws NotFoundException for unknown user', async () => {
      (mockPrisma.user.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(svc.softDelete('missing')).rejects.toThrow(NotFoundException);
    });

    it('sets deletedAt on user and disables login in transaction', async () => {
      (mockPrisma.user.findFirst as jest.Mock).mockResolvedValue({ id: 'u1' });
      mockTx.user.update.mockResolvedValue({});
      mockTx.login.updateMany.mockResolvedValue({});

      await svc.softDelete('u1');

      expect(mockTx.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date) }) }),
      );
      expect(mockTx.login.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'u1' }, data: { isActive: false } }),
      );
    });
  });

  // ─── revokeSession ────────────────────────────────────────────────────────

  describe('revokeSession', () => {
    it('throws ForbiddenException when revoking own session', async () => {
      await expect(svc.revokeSession('same', 'same')).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when target has no Login record', async () => {
      (mockPrisma.login.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(svc.revokeSession('admin', 'user')).rejects.toThrow(NotFoundException);
    });

    it('increments tokenVersion', async () => {
      (mockPrisma.login.findUnique as jest.Mock).mockResolvedValue({ userId: 'user' });
      (mockPrisma.login.update as jest.Mock).mockResolvedValue({});

      await svc.revokeSession('admin', 'user');

      expect(mockPrisma.login.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user' },
          data: { tokenVersion: { increment: 1 } },
        }),
      );
    });
  });

  // ─── resetPassword ────────────────────────────────────────────────────────

  describe('resetPassword', () => {
    it('throws NotFoundException when Login not found', async () => {
      (mockPrisma.login.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(svc.resetPassword('u1', { password: 'newpass' })).rejects.toThrow(NotFoundException);
    });

    it('hashes the password and increments tokenVersion', async () => {
      (mockPrisma.login.findUnique as jest.Mock).mockResolvedValue({ userId: 'u1' });
      (mockPrisma.login.update as jest.Mock).mockResolvedValue({});

      await svc.resetPassword('u1', { password: 'newpass' });

      expect(bcryptHash).toHaveBeenCalledWith('newpass', expect.any(Number));
      expect(mockPrisma.login.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            passwordHash: '$2b$10$hashed',
            tokenVersion: { increment: 1 },
          }),
        }),
      );
    });
  });
});
