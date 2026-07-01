import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
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

// Routes prisma.user.findFirst by where.id so tests can give the "target
// user" lookup and the "requester role" lookup different answers.
function mockUsersById(byId: Record<string, any>) {
  (mockPrisma.user.findFirst as jest.Mock).mockImplementation(
    ({ where }: any) => Promise.resolve(byId[where.id] ?? null),
  );
}

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
    it('returns all users for a Super Admin requester', async () => {
      mockUsersById({ 'super-1': { role: 'SUPER_ADMIN' } });
      (mockPrisma.user.findMany as jest.Mock).mockResolvedValue([{ id: 'u1' }]);

      const result = await svc.list('super-1');

      expect(result).toEqual([{ id: 'u1' }]);
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { deletedAt: null } }),
      );
    });

    it('excludes Super Admin accounts for a non-Super-Admin requester', async () => {
      mockUsersById({ 'admin-1': { role: 'ADMIN' } });
      (mockPrisma.user.findMany as jest.Mock).mockResolvedValue([{ id: 'u1' }]);

      const result = await svc.list('admin-1');

      expect(result).toEqual([{ id: 'u1' }]);
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { deletedAt: null, role: { not: 'SUPER_ADMIN' } },
        }),
      );
    });
  });

  describe('findById', () => {
    it('throws NotFoundException for unknown id', async () => {
      mockUsersById({});
      await expect(svc.findById('missing', 'admin-1')).rejects.toThrow(NotFoundException);
    });

    it('returns user when found', async () => {
      const user = { id: 'u1', name: 'Alice', role: 'MANAGER' };
      mockUsersById({ u1: user });
      await expect(svc.findById('u1', 'admin-1')).resolves.toEqual(user);
    });

    it('hides a Super Admin target from a non-Super-Admin requester (404)', async () => {
      mockUsersById({
        sa1: { id: 'sa1', role: 'SUPER_ADMIN' },
        'admin-1': { role: 'ADMIN' },
      });
      await expect(svc.findById('sa1', 'admin-1')).rejects.toThrow(NotFoundException);
    });

    it('allows a Super Admin requester to view another Super Admin', async () => {
      const target = { id: 'sa1', role: 'SUPER_ADMIN' };
      mockUsersById({ sa1: target, 'super-1': { role: 'SUPER_ADMIN' } });
      await expect(svc.findById('sa1', 'super-1')).resolves.toEqual(target);
    });
  });

  // ─── create ───────────────────────────────────────────────────────────────

  describe('create', () => {
    const dto = {
      name: 'Bob', email: 'bob@example.com', role: 'MANAGER' as const,
      password: 'password123', locationId: undefined, permissions: undefined,
    };

    it('creates user + login inside a transaction', async () => {
      mockTx.user.create.mockResolvedValue({ id: 'new-id', ...dto });

      await svc.create(dto, [], 'admin-1');

      expect(mockTx.user.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ email: 'bob@example.com', role: 'MANAGER' }) }),
      );
      expect(mockTx.login.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ userId: 'new-id', passwordHash: '$2b$10$hashed' }) }),
      );
    });

    it('validates locationId when provided', async () => {
      (mockPrisma.location.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(svc.create({ ...dto, locationId: 'loc-1' }, [], 'admin-1')).rejects.toThrow(BadRequestException);
    });

    it('throws ConflictException on duplicate email (P2002)', async () => {
      mockTx.user.create.mockRejectedValue({ code: 'P2002' });
      await expect(svc.create(dto, [], 'admin-1')).rejects.toThrow(ConflictException);
    });

    it('uses role defaults for permissions when none provided', async () => {
      mockTx.user.create.mockResolvedValue({ id: 'x' });

      await svc.create({ ...dto, role: 'MANAGER', permissions: undefined }, [], 'admin-1');

      expect(mockTx.login.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            permissions: expect.arrayContaining(['runs:view']),
          }),
        }),
      );
    });

    it('blocks assigning the Super Admin role unless requester is a Super Admin', async () => {
      mockUsersById({ 'admin-1': { role: 'ADMIN' } });
      await expect(
        svc.create({ ...dto, role: 'SUPER_ADMIN' }, [], 'admin-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows assigning the Super Admin role when requester is a Super Admin', async () => {
      mockUsersById({ 'super-1': { role: 'SUPER_ADMIN' } });
      mockTx.user.create.mockResolvedValue({ id: 'new-id' });

      await expect(
        svc.create({ ...dto, role: 'SUPER_ADMIN' }, [], 'super-1'),
      ).resolves.toBeDefined();
    });
  });

  // ─── update ───────────────────────────────────────────────────────────────

  describe('update', () => {
    it('throws NotFoundException for unknown user', async () => {
      mockUsersById({});
      await expect(svc.update('missing', { name: 'X' }, 'admin-1')).rejects.toThrow(NotFoundException);
    });

    it('validates locationId when updating', async () => {
      mockUsersById({ u1: { id: 'u1', role: 'MANAGER' } });
      (mockPrisma.location.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(svc.update('u1', { locationId: 'bad-loc' }, 'admin-1')).rejects.toThrow(BadRequestException);
    });

    it('allows setting locationId to null', async () => {
      mockUsersById({ u1: { id: 'u1', role: 'MANAGER' } });
      (mockPrisma.user.update as jest.Mock).mockResolvedValue({ id: 'u1', locationId: null });

      await svc.update('u1', { locationId: null }, 'admin-1');

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { locationId: null } }),
      );
    });

    it('blocks promoting a user to Super Admin unless requester is a Super Admin', async () => {
      mockUsersById({ u1: { id: 'u1', role: 'MANAGER' }, 'admin-1': { role: 'ADMIN' } });
      await expect(svc.update('u1', { role: 'SUPER_ADMIN' }, 'admin-1')).rejects.toThrow(ForbiddenException);
    });

    it('blocks modifying an existing Super Admin unless requester is a Super Admin', async () => {
      mockUsersById({ sa1: { id: 'sa1', role: 'SUPER_ADMIN' }, 'admin-1': { role: 'ADMIN' } });
      await expect(svc.update('sa1', { role: 'SUPER_ADMIN' }, 'admin-1')).rejects.toThrow(ForbiddenException);
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
      mockUsersById({});
      await expect(
        svc.updatePermissions('admin', 'user', { permissions: ['invalid:permission'] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when target has no Login record', async () => {
      mockUsersById({});
      (mockPrisma.login.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(
        svc.updatePermissions('admin', 'user', { permissions: ['orders:view'] }),
      ).rejects.toThrow(NotFoundException);
    });

    it('increments tokenVersion on success', async () => {
      mockUsersById({});
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

    it('hides a Super Admin target from a non-Super-Admin requester (404)', async () => {
      mockUsersById({ sa1: { role: 'SUPER_ADMIN' }, 'admin-1': { role: 'ADMIN' } });
      await expect(
        svc.updatePermissions('admin-1', 'sa1', { permissions: ['orders:view'] }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── softDelete ───────────────────────────────────────────────────────────

  describe('softDelete', () => {
    it('throws NotFoundException for unknown user', async () => {
      mockUsersById({});
      await expect(svc.softDelete('missing', 'admin-1')).rejects.toThrow(NotFoundException);
    });

    it('sets deletedAt on user and disables login in transaction', async () => {
      mockUsersById({ u1: { id: 'u1', role: 'MANAGER' } });
      mockTx.user.update.mockResolvedValue({});
      mockTx.login.updateMany.mockResolvedValue({});

      await svc.softDelete('u1', 'admin-1');

      expect(mockTx.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date) }) }),
      );
      expect(mockTx.login.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'u1' }, data: { isActive: false } }),
      );
    });

    it('blocks deleting a Super Admin unless requester is a Super Admin', async () => {
      mockUsersById({ sa1: { id: 'sa1', role: 'SUPER_ADMIN' }, 'admin-1': { role: 'ADMIN' } });
      await expect(svc.softDelete('sa1', 'admin-1')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── revokeSession ────────────────────────────────────────────────────────

  describe('revokeSession', () => {
    it('throws ForbiddenException when revoking own session', async () => {
      await expect(svc.revokeSession('same', 'same')).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when target has no Login record', async () => {
      mockUsersById({});
      (mockPrisma.login.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(svc.revokeSession('admin', 'user')).rejects.toThrow(NotFoundException);
    });

    it('increments tokenVersion', async () => {
      mockUsersById({});
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

    it('hides a Super Admin target from a non-Super-Admin requester (404)', async () => {
      mockUsersById({ sa1: { role: 'SUPER_ADMIN' }, 'admin-1': { role: 'ADMIN' } });
      await expect(svc.revokeSession('admin-1', 'sa1')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── resetPassword ────────────────────────────────────────────────────────

  describe('resetPassword', () => {
    it('throws NotFoundException when Login not found', async () => {
      mockUsersById({});
      (mockPrisma.login.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(svc.resetPassword('u1', { password: 'newpass' }, 'admin-1')).rejects.toThrow(NotFoundException);
    });

    it('hashes the password and increments tokenVersion', async () => {
      mockUsersById({});
      (mockPrisma.login.findUnique as jest.Mock).mockResolvedValue({ userId: 'u1' });
      (mockPrisma.login.update as jest.Mock).mockResolvedValue({});

      await svc.resetPassword('u1', { password: 'newpass' }, 'admin-1');

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

    it('hides a Super Admin target from a non-Super-Admin requester (404)', async () => {
      mockUsersById({ sa1: { role: 'SUPER_ADMIN' }, 'admin-1': { role: 'ADMIN' } });
      await expect(svc.resetPassword('sa1', { password: 'newpass' }, 'admin-1')).rejects.toThrow(NotFoundException);
    });
  });
});
