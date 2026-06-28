import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import type {
  CreateUserDto,
  ResetPasswordDto,
  UpdatePermissionsDto,
  UpdateUserDto,
} from '@app/contracts';
import { PrismaService } from 'apps/backend/prisma/prisma.service';
import { ContextLogger } from '../common/logger/context.logger';
import { ALL_PERMISSIONS, ROLE_PERMISSIONS } from '../auth/permissions.map';

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS ?? '10', 10);

@Injectable()
export class UsersService {
  private readonly logger = new ContextLogger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.user.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        locationId: true,
        location: { select: { id: true, code: true, name: true } },
        createdAt: true,
        login: {
          select: {
            permissions: true,
            isActive: true,
            lastLoginAt: true,
            failedLoginAttempts: true,
            lastFailedLoginAt: true,
            createdAt: true,
          },
        },
      },
    });
  }

  async findById(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        locationId: true,
        location: { select: { id: true, code: true, name: true } },
        createdAt: true,
        updatedAt: true,
        login: {
          select: {
            permissions: true,
            isActive: true,
            lastLoginAt: true,
            failedLoginAttempts: true,
            lastFailedLoginAt: true,
            createdAt: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async findMe(userId: string) {
    const result = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        location: { select: { id: true, code: true, name: true } },
        login: {
          select: {
            permissions: true,
            lastLoginAt: true,
          },
        },
      },
    });

    if (!result) {
      throw new NotFoundException('User not found');
    }

    return {
      id: result.id,
      name: result.name,
      email: result.email,
      role: result.role,
      isActive: result.isActive,
      location: result.location,
      permissions: result.login?.permissions ?? [],
      lastLoginAt: result.login?.lastLoginAt ?? null,
    };
  }

  async create(dto: CreateUserDto) {
    // Validate locationId if provided
    if (dto.locationId) {
      const location = await this.prisma.location.findUnique({
        where: { id: dto.locationId },
        select: { isActive: true },
      });
      if (!location || !location.isActive) {
        throw new BadRequestException('Invalid or inactive locationId');
      }
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const permissions = dto.permissions ?? ROLE_PERMISSIONS[dto.role] ?? [];

    try {
      const result = await this.prisma.transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            name: dto.name,
            email: dto.email,
            role: dto.role,
            locationId: dto.locationId ?? null,
            isActive: true,
          },
        });

        await tx.login.create({
          data: {
            userId: user.id,
            passwordHash,
            permissions,
          },
        });

        return user;
      });

      this.logger.log(`User created id=${result.id}`);
      return result;
    } catch (err: any) {
      // Partial unique index violation: active user with same email already exists
      if (
        err?.code === 'P2002' ||
        err?.message?.includes('User_email_active_unique')
      ) {
        throw new ConflictException('Email already in use');
      }
      throw err;
    }
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (dto.locationId !== undefined) {
      if (dto.locationId !== null) {
        const location = await this.prisma.location.findUnique({
          where: { id: dto.locationId },
          select: { isActive: true },
        });
        if (!location || !location.isActive) {
          throw new BadRequestException('Invalid or inactive locationId');
        }
      }
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.role !== undefined && { role: dto.role }),
        ...(dto.locationId !== undefined && { locationId: dto.locationId }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async updatePermissions(
    requestingUserId: string,
    targetId: string,
    dto: UpdatePermissionsDto,
  ) {
    if (requestingUserId === targetId) {
      throw new ForbiddenException('You cannot modify your own permissions');
    }

    // Validate all permission strings
    const unknown = dto.permissions.filter((p) => !ALL_PERMISSIONS.includes(p));
    if (unknown.length > 0) {
      throw new BadRequestException(`Unknown permission: ${unknown[0]}`);
    }

    const loginRecord = await this.prisma.login.findUnique({
      where: { userId: targetId },
    });
    if (!loginRecord) {
      throw new NotFoundException('User login record not found');
    }

    await this.prisma.login.update({
      where: { userId: targetId },
      data: {
        permissions: dto.permissions,
        tokenVersion: { increment: 1 },
      },
    });

    this.logger.log(`Permissions updated for userId=${targetId}`);
  }

  async softDelete(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      await tx.login.updateMany({
        where: { userId: id },
        data: { isActive: false },
      });
    });

    this.logger.log(`User soft-deleted id=${id}`);
  }

  async revokeSession(requestingUserId: string, targetId: string) {
    if (requestingUserId === targetId) {
      throw new ForbiddenException('You cannot revoke your own session');
    }

    const loginRecord = await this.prisma.login.findUnique({
      where: { userId: targetId },
    });
    if (!loginRecord) {
      throw new NotFoundException('User login record not found');
    }

    await this.prisma.login.update({
      where: { userId: targetId },
      data: { tokenVersion: { increment: 1 } },
    });

    this.logger.log(`Session revoked for userId=${targetId}`);
  }

  async resetPassword(id: string, dto: ResetPasswordDto) {
    const loginRecord = await this.prisma.login.findUnique({
      where: { userId: id },
    });
    if (!loginRecord) {
      throw new NotFoundException('User login record not found');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    await this.prisma.login.update({
      where: { userId: id },
      data: {
        passwordHash,
        tokenVersion: { increment: 1 },
      },
    });

    this.logger.log(`Password reset for userId=${id}`);
  }
}
