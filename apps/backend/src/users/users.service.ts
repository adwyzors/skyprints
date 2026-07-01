import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import type {
  AssignStagePermissionsDto,
  CreateUserDto,
  ManagerStagePermissionDto,
  ResetPasswordDto,
  UpdatePermissionsDto,
  UpdateUserDto,
} from '@app/contracts';
import { PrismaExecutor, PrismaService } from '../../prisma/prisma.service';
import { ContextLogger } from '../common/logger/context.logger';
import { ALL_PERMISSIONS, ROLE_PERMISSIONS } from '../auth/permissions.map';

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS ?? '10', 10);

@Injectable()
export class UsersService {
  private readonly logger = new ContextLogger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async isSuperAdmin(userId: string): Promise<boolean> {
    const requester = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { role: true },
    });
    return requester?.role === 'SUPER_ADMIN';
  }

  // Super Admin accounts are invisible and untouchable to non-Super-Admins —
  // 404 (rather than 403) avoids confirming that the account even exists.
  private async assertTargetVisible(
    targetUserId: string,
    requestingUserId: string,
  ): Promise<void> {
    const target = await this.prisma.user.findFirst({
      where: { id: targetUserId, deletedAt: null },
      select: { role: true },
    });
    if (
      target?.role === 'SUPER_ADMIN' &&
      !(await this.isSuperAdmin(requestingUserId))
    ) {
      throw new NotFoundException('User not found');
    }
  }

  async list(requestingUserId: string) {
    const requesterIsSuperAdmin = await this.isSuperAdmin(requestingUserId);

    return this.prisma.user.findMany({
      where: {
        deletedAt: null,
        ...(requesterIsSuperAdmin ? {} : { role: { not: 'SUPER_ADMIN' } }),
      },
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
            username: true,
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

  async findById(id: string, requestingUserId: string) {
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

    // Super Admin accounts are invisible to non-Super-Admins — a 404 (rather
    // than 403) avoids confirming that the account even exists.
    if (!user || (user.role === 'SUPER_ADMIN' && !(await this.isSuperAdmin(requestingUserId)))) {
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

  // Permission strings don't distinguish SUPER_ADMIN from ADMIN (they share
  // the same permission set), so granting/removing the SUPER_ADMIN role has
  // to be checked against the requester's actual role in the database.
  private async assertRequesterIsSuperAdmin(
    requestingUserId: string,
  ): Promise<void> {
    const requester = await this.prisma.user.findFirst({
      where: { id: requestingUserId, deletedAt: null },
      select: { role: true },
    });
    if (!requester || requester.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException(
        'Only Super Admins can assign the Super Admin role',
      );
    }
  }

  async create(
    dto: CreateUserDto,
    requestingUserPermissions: string[],
    requestingUserId: string,
  ) {
    if (dto.role === 'SUPER_ADMIN') {
      await this.assertRequesterIsSuperAdmin(requestingUserId);
    }

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
    // Only requesters holding users:permissions:manage may hand out a custom
    // permission set — everyone else's created users get the role defaults,
    // regardless of what the request body contains.
    const canCustomizePermissions = requestingUserPermissions.includes(
      'users:permissions:manage',
    );
    const permissions = canCustomizePermissions
      ? (dto.permissions ?? ROLE_PERMISSIONS[dto.role] ?? [])
      : (ROLE_PERMISSIONS[dto.role] ?? []);

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
            ...(dto.username ? { username: dto.username } : {}),
          },
        });

        return user;
      });

      this.logger.log(`User created id=${result.id}`);
      return result;
    } catch (err: any) {
      // Partial unique index violation: active user with same email already exists
      if (err?.code === 'P2002') {
        if (
          err?.meta?.target?.includes('username') ||
          err?.message?.includes('Login_username_key')
        ) {
          throw new ConflictException('Username already in use');
        }
        throw new ConflictException('Email already in use');
      }
      if (err?.message?.includes('User_email_active_unique')) {
        throw new ConflictException('Email already in use');
      }
      throw err;
    }
  }

  async update(id: string, dto: UpdateUserDto, requestingUserId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (
      dto.role !== undefined &&
      (dto.role === 'SUPER_ADMIN' || user.role === 'SUPER_ADMIN')
    ) {
      await this.assertRequesterIsSuperAdmin(requestingUserId);
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

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.role !== undefined && { role: dto.role }),
        ...(dto.locationId !== undefined && { locationId: dto.locationId }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    if (dto.username !== undefined) {
      try {
        await this.prisma.login.update({
          where: { userId: id },
          data: { username: dto.username ?? null },
        });
      } catch (err: any) {
        if (err?.code === 'P2002') {
          throw new ConflictException('Username already in use');
        }
        throw err;
      }
    }

    return updatedUser;
  }

  async updatePermissions(
    requestingUserId: string,
    targetId: string,
    dto: UpdatePermissionsDto,
  ) {
    if (requestingUserId === targetId) {
      throw new ForbiddenException('You cannot modify your own permissions');
    }
    await this.assertTargetVisible(targetId, requestingUserId);

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

  async softDelete(id: string, requestingUserId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    await this.assertTargetVisible(id, requestingUserId);

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
    await this.assertTargetVisible(targetId, requestingUserId);

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

  async resetPassword(
    id: string,
    dto: ResetPasswordDto,
    requestingUserId: string,
  ) {
    await this.assertTargetVisible(id, requestingUserId);

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

  async getStagePermissions(
    userId: string,
  ): Promise<ManagerStagePermissionDto[]> {
    const rows = await this.prisma.managerStagePermission.findMany({
      where: { managerId: userId },
      include: {
        process: { select: { name: true } },
        lifecycleStage: { select: { code: true } },
      },
    });

    return rows.map((r) => ({
      processId: r.processId,
      processName: r.process.name,
      lifecycleStageId: r.lifecycleStageId,
      stageCode: r.lifecycleStage.code,
    }));
  }

  async updateStagePermissions(
    userId: string,
    entries: AssignStagePermissionsDto,
  ): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { role: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role !== 'MANAGER') {
      throw new BadRequestException(
        'Stage permissions can only be assigned to MANAGER-role users',
      );
    }

    // Validate every (processId, lifecycleStageId) pair is internally consistent —
    // the stage must actually belong to that process's lifecycle workflow type.
    for (const entry of entries) {
      const runDefs = await this.prisma.processRunDefinition.findMany({
        where: { processId: entry.processId },
        select: { runTemplate: { select: { lifecycleWorkflowTypeId: true } } },
      });
      const workflowTypeIds = new Set(
        runDefs.map((d) => d.runTemplate.lifecycleWorkflowTypeId),
      );

      const stage = await this.prisma.workflowStatus.findUnique({
        where: { id: entry.lifecycleStageId },
        select: { workflowTypeId: true },
      });

      if (!stage || !workflowTypeIds.has(stage.workflowTypeId)) {
        throw new BadRequestException(
          `lifecycleStageId ${entry.lifecycleStageId} does not belong to processId ${entry.processId}`,
        );
      }
    }

    await this.prisma.transaction(async (tx) => {
      // Snapshot which (processId, lifecycleStageId) pairs already had ANY
      // manager assigned, before this save — used to detect newly-covered pairs.
      const beforePairs = new Set(
        (
          await tx.managerStagePermission.findMany({
            distinct: ['processId', 'lifecycleStageId'],
            select: { processId: true, lifecycleStageId: true },
          })
        ).map((p) => `${p.processId}:${p.lifecycleStageId}`),
      );

      await tx.managerStagePermission.deleteMany({
        where: { managerId: userId },
      });

      if (entries.length > 0) {
        await tx.managerStagePermission.createMany({
          data: entries.map((e) => ({
            managerId: userId,
            processId: e.processId,
            lifecycleStageId: e.lifecycleStageId,
          })),
        });
      }

      const newlyCoveredPairs = entries.filter(
        (e) => !beforePairs.has(`${e.processId}:${e.lifecycleStageId}`),
      );

      for (const pair of newlyCoveredPairs) {
        await this.backfillClaimsForPair(
          tx,
          pair.processId,
          pair.lifecycleStageId,
        );
      }
    });

    this.logger.log(`Stage permissions updated for managerId=${userId}`);
  }

  private async backfillClaimsForPair(
    tx: PrismaExecutor,
    processId: string,
    lifecycleStageId: string,
  ): Promise<void> {
    const stage = await tx.workflowStatus.findUnique({
      where: { id: lifecycleStageId },
      select: { code: true },
    });
    if (!stage) return;

    const candidates = await tx.processRun.findMany({
      where: {
        claimedBy: null,
        executorId: { not: null },
        lifeCycleStatusCode: stage.code,
        orderProcess: { processId },
      },
      select: { id: true, executorId: true, createdAt: true },
    });

    for (const run of candidates) {
      const enteredStageHistory = await tx.processRunLifecycleHistory.findFirst(
        {
          where: {
            processRunId: run.id,
            statusCode: stage.code,
            completedAt: null,
          },
          select: { createdAt: true },
        },
      );

      await tx.processRun.update({
        where: { id: run.id },
        data: {
          claimedBy: run.executorId,
          claimedAt: enteredStageHistory?.createdAt ?? run.createdAt,
        },
      });
    }

    if (candidates.length > 0) {
      this.logger.log(
        `Backfilled ${candidates.length} in-flight run(s) claimedBy for processId=${processId} stage=${stage.code}`,
      );
    }
  }
}
