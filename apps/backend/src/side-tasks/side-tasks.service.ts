import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  SideTaskPriority,
  SideTaskStageOutcome,
  SideTaskStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ContextLogger } from '../common/logger/context.logger';
import { generateFiscalCode } from '../common/utils/fiscal-year.utils';
import {
  AbandonSideTaskDto,
  CreateSideTaskDto,
  CreateSideTaskStageTypeDto,
  PassStageDto,
  ReassignStageDto,
  SendBackReviewDto,
  SubmitReviewDto,
  UpdateSideTaskDto,
  UpdateSideTaskStageTypeDto,
} from './dto/side-tasks.dto';

import { CloudflareService } from '../common/cloudflare.service';

@Injectable()
export class SideTasksService {
  private readonly logger = new ContextLogger(SideTasksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudflare: CloudflareService,
  ) {}

  /* ========================================================================
   * AUTHORITATIVE TIMING & VALIDATION HELPERS
   * ======================================================================== */

  /**
   * Authoritative server helper to finalize timing for an active stage history record.
   * If the stage is currently running (lastStartedAt is set and pausedAt is null),
   * accumulates active elapsed seconds up to `now`.
   */
  private finalizeStageTiming(
    stageHistory: {
      totalTimeSeconds: number;
      lastStartedAt: Date | null;
      pausedAt: Date | null;
    },
    now: Date,
  ): { totalTimeSeconds: number; pausedAt: Date | null } {
    let totalTime = stageHistory.totalTimeSeconds;
    let pausedAt = stageHistory.pausedAt;

    if (stageHistory.lastStartedAt && !stageHistory.pausedAt) {
      const elapsedSeconds = Math.max(
        0,
        Math.floor((now.getTime() - stageHistory.lastStartedAt.getTime()) / 1000),
      );
      totalTime += elapsedSeconds;
      pausedAt = now;
    }

    return {
      totalTimeSeconds: totalTime,
      pausedAt,
    };
  }

  /**
   * Enforces the single-active-timer restriction for Side Tasks.
   * Currently updated to allow multiple side tasks to run simultaneously per user request.
   */
  private async validateSingleActiveTimer(
    tx: Prisma.TransactionClient,
    userId: string,
    excludeStageHistoryId?: string,
  ): Promise<void> {
    // Disabled single active timer check to allow users to start multiple side tasks simultaneously.
    return;
  }

  /**
   * Includes for full SideTask details
   */
  private readonly sideTaskInclude = {
    customer: { select: { id: true, code: true, name: true } },
    createdBy: { select: { id: true, name: true, email: true } },
    currentAssignee: { select: { id: true, name: true, email: true } },
    stageHistories: {
      include: {
        stageType: { select: { id: true, code: true, name: true } },
        assignedUser: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'asc' as const },
    },
  } satisfies Prisma.SideTaskInclude;

  /* ========================================================================
   * STAGE TYPE MANAGEMENT
   * ======================================================================== */

  async createStageType(dto: CreateSideTaskStageTypeDto) {
    const existing = await this.prisma.sideTaskStageType.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new ConflictException(`Stage type code ${dto.code} already exists`);
    }

    return this.prisma.sideTaskStageType.create({
      data: {
        name: dto.name,
        code: dto.code,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async findAllStageTypes() {
    return this.prisma.sideTaskStageType.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async updateStageType(id: string, dto: UpdateSideTaskStageTypeDto) {
    const existing = await this.prisma.sideTaskStageType.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Stage type not found');
    }

    return this.prisma.sideTaskStageType.update({
      where: { id },
      data: dto,
    });
  }

  /* ========================================================================
   * SIDE TASK LIFECYCLE OPERATIONS
   * ======================================================================== */

  /**
   * Create a new SideTask with initial stage history record (unstarted).
   */
  async create(createdById: string, dto: CreateSideTaskDto) {
    if (dto.images && dto.images.length > 2) {
      throw new BadRequestException('Maximum 2 images are allowed');
    }

    // Verify stage type exists and is active
    const stageType = await this.prisma.sideTaskStageType.findUnique({
      where: { id: dto.initialStageTypeId },
    });
    if (!stageType || !stageType.isActive) {
      throw new BadRequestException('Selected initial stage type is invalid or inactive');
    }

    // Verify assignee exists
    const assignee = await this.prisma.user.findUnique({
      where: { id: dto.initialAssigneeId },
    });
    if (!assignee || !assignee.isActive) {
      throw new BadRequestException('Selected initial assignee is invalid or inactive');
    }

    // Verify customer if provided
    if (dto.customerId) {
      const customer = await this.prisma.customer.findUnique({
        where: { id: dto.customerId },
      });
      if (!customer) {
        throw new BadRequestException('Selected customer not found');
      }
    }

    return this.prisma.transaction(async (tx) => {
      const fiscalCode = await generateFiscalCode(tx, 'ST');
      const formattedCode = fiscalCode.startsWith('ST')
        ? fiscalCode
        : `ST-${fiscalCode}`;

      const sideTask = await tx.sideTask.create({
        data: {
          code: formattedCode,
          title: dto.title,
          description: dto.description,
          priority: dto.priority ?? SideTaskPriority.MEDIUM,
          status: SideTaskStatus.ASSIGNED,
          requiredBy: dto.requiredBy ? new Date(dto.requiredBy) : null,
          images: dto.images ?? [],
          customerId: dto.customerId ?? null,
          createdById,
          currentAssigneeId: dto.initialAssigneeId,
          currentStageTypeId: dto.initialStageTypeId,
        },
      });

      await tx.sideTaskStageHistory.create({
        data: {
          sideTaskId: sideTask.id,
          stageTypeId: dto.initialStageTypeId,
          assignedUserId: dto.initialAssigneeId,
        },
      });

      return tx.sideTask.findUnique({
        where: { id: sideTask.id },
        include: this.sideTaskInclude,
      });
    });
  }

  /**
   * Returns tasks assigned to the current user that are active.
   */
  async getMine(userId: string) {
    return this.prisma.sideTask.findMany({
      where: {
        currentAssigneeId: userId,
        status: { notIn: [SideTaskStatus.COMPLETED, SideTaskStatus.ABANDONED] },
      },
      include: this.sideTaskInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Returns all active tasks for privileged managers/admins.
   */
  async getAll(query: {
    status?: SideTaskStatus;
    customerId?: string;
    priority?: SideTaskPriority;
    stageTypeId?: string;
    search?: string;
  }) {
    const where: Prisma.SideTaskWhereInput = {
      status: query.status
        ? query.status
        : { notIn: [SideTaskStatus.COMPLETED, SideTaskStatus.ABANDONED] },
      customerId: query.customerId ?? undefined,
      priority: query.priority ?? undefined,
      currentStageTypeId: query.stageTypeId ?? undefined,
    };

    if (query.search && query.search.trim() !== '') {
      const search = query.search.trim();
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.sideTask.findMany({
      where,
      include: this.sideTaskInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Returns completed tasks for separate completed route.
   */
  async getCompleted() {
    return this.prisma.sideTask.findMany({
      where: { status: SideTaskStatus.COMPLETED },
      include: this.sideTaskInclude,
      orderBy: { completedAt: 'desc' },
    });
  }

  /**
   * Get single SideTask by ID with complete stage history.
   */
  async getOne(id: string) {
    const task = await this.prisma.sideTask.findUnique({
      where: { id },
      include: this.sideTaskInclude,
    });

    if (!task) {
      throw new NotFoundException('Side task not found');
    }

    return task;
  }

  /**
   * Metadata update (title, description, customer, priority, requiredBy, images)
   */
  async update(id: string, dto: UpdateSideTaskDto) {
    if (dto.images && dto.images.length > 2) {
      throw new BadRequestException('Maximum 2 images are allowed');
    }

    const task = await this.prisma.sideTask.findUnique({ where: { id } });
    if (!task) {
      throw new NotFoundException('Side task not found');
    }

    return this.prisma.sideTask.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        customerId: dto.customerId,
        priority: dto.priority,
        requiredBy: dto.requiredBy ? new Date(dto.requiredBy) : undefined,
        images: dto.images,
      },
      include: this.sideTaskInclude,
    });
  }

  /* ========================================================================
   * WORKFLOW TIMER & STAGE ACTIONS
   * ======================================================================== */

  /**
   * Start stage timer
   */
  async startStage(id: string, userId: string) {
    return this.prisma.transaction(async (tx) => {
      const task = await tx.sideTask.findUnique({ where: { id } });
      if (!task) throw new NotFoundException('Side task not found');
      if (task.currentAssigneeId !== userId) {
        throw new ForbiddenException('You are not assigned to this task');
      }
      if (
        task.status === SideTaskStatus.COMPLETED ||
        task.status === SideTaskStatus.ABANDONED
      ) {
        throw new BadRequestException('Task is completed or abandoned');
      }

      // Find active stage history
      const currentHistory = await tx.sideTaskStageHistory.findFirst({
        where: { sideTaskId: id, completedAt: null },
        orderBy: { createdAt: 'desc' },
      });

      if (!currentHistory) {
        throw new BadRequestException('No active stage history found');
      }

      if (currentHistory.startedAt !== null && currentHistory.pausedAt === null) {
        throw new BadRequestException('Stage timer is already running');
      }

      // Enforce single active timer constraint
      await this.validateSingleActiveTimer(tx, userId, currentHistory.id);

      const now = new Date();
      await tx.sideTaskStageHistory.update({
        where: { id: currentHistory.id },
        data: {
          startedAt: currentHistory.startedAt ?? now,
          lastStartedAt: now,
          pausedAt: null,
        },
      });

      await tx.sideTask.update({
        where: { id },
        data: { status: SideTaskStatus.IN_PROGRESS },
      });

      return tx.sideTask.findUnique({
        where: { id },
        include: this.sideTaskInclude,
      });
    });
  }

  /**
   * Pause stage timer
   */
  async pauseStage(id: string, userId: string) {
    return this.prisma.transaction(async (tx) => {
      const task = await tx.sideTask.findUnique({ where: { id } });
      if (!task) throw new NotFoundException('Side task not found');
      if (task.currentAssigneeId !== userId) {
        throw new ForbiddenException('You are not assigned to this task');
      }

      const currentHistory = await tx.sideTaskStageHistory.findFirst({
        where: { sideTaskId: id, completedAt: null },
        orderBy: { createdAt: 'desc' },
      });

      if (!currentHistory) {
        throw new BadRequestException('No active stage history found');
      }

      if (!currentHistory.lastStartedAt || currentHistory.pausedAt !== null) {
        throw new BadRequestException('Stage is not currently running');
      }

      const now = new Date();
      const timing = this.finalizeStageTiming(currentHistory, now);

      await tx.sideTaskStageHistory.update({
        where: { id: currentHistory.id },
        data: {
          totalTimeSeconds: timing.totalTimeSeconds,
          pausedAt: timing.pausedAt,
        },
      });

      return tx.sideTask.findUnique({
        where: { id },
        include: this.sideTaskInclude,
      });
    });
  }

  /**
   * Resume stage timer
   */
  async resumeStage(id: string, userId: string) {
    return this.prisma.transaction(async (tx) => {
      const task = await tx.sideTask.findUnique({ where: { id } });
      if (!task) throw new NotFoundException('Side task not found');
      if (task.currentAssigneeId !== userId) {
        throw new ForbiddenException('You are not assigned to this task');
      }

      const currentHistory = await tx.sideTaskStageHistory.findFirst({
        where: { sideTaskId: id, completedAt: null },
        orderBy: { createdAt: 'desc' },
      });

      if (!currentHistory) {
        throw new BadRequestException('No active stage history found');
      }

      if (currentHistory.pausedAt === null) {
        throw new BadRequestException('Stage timer is not paused');
      }

      // Enforce single active timer constraint
      await this.validateSingleActiveTimer(tx, userId, currentHistory.id);

      const now = new Date();
      await tx.sideTaskStageHistory.update({
        where: { id: currentHistory.id },
        data: {
          lastStartedAt: now,
          pausedAt: null,
        },
      });

      return tx.sideTask.findUnique({
        where: { id },
        include: this.sideTaskInclude,
      });
    });
  }

  /**
   * Pass task to another stage
   */
  async passStage(id: string, userId: string, dto: PassStageDto) {
    return this.prisma.transaction(async (tx) => {
      const task = await tx.sideTask.findUnique({ where: { id } });
      if (!task) throw new NotFoundException('Side task not found');
      if (task.currentAssigneeId !== userId) {
        throw new ForbiddenException('You are not assigned to this task');
      }

      const currentHistory = await tx.sideTaskStageHistory.findFirst({
        where: { sideTaskId: id, completedAt: null },
        orderBy: { createdAt: 'desc' },
      });

      if (!currentHistory) {
        throw new BadRequestException('No active stage history found');
      }

      // Verify next stage type and assignee
      const nextStageType = await tx.sideTaskStageType.findUnique({
        where: { id: dto.nextStageTypeId },
      });
      if (!nextStageType || !nextStageType.isActive) {
        throw new BadRequestException('Target stage type is invalid or inactive');
      }

      const nextAssignee = await tx.user.findUnique({
        where: { id: dto.nextAssigneeId },
      });
      if (!nextAssignee || !nextAssignee.isActive) {
        throw new BadRequestException('Target assignee is invalid or inactive');
      }

      const now = new Date();
      const timing = this.finalizeStageTiming(currentHistory, now);

      // Finalize current history
      await tx.sideTaskStageHistory.update({
        where: { id: currentHistory.id },
        data: {
          totalTimeSeconds: timing.totalTimeSeconds,
          pausedAt: timing.pausedAt,
          completedAt: now,
          completionNote: dto.completionNote ?? null,
          outcome: SideTaskStageOutcome.COMPLETED,
        },
      });

      // Create new stage history (unstarted)
      await tx.sideTaskStageHistory.create({
        data: {
          sideTaskId: id,
          stageTypeId: dto.nextStageTypeId,
          assignedUserId: dto.nextAssigneeId,
        },
      });

      // Update task pointer
      await tx.sideTask.update({
        where: { id },
        data: {
          currentStageTypeId: dto.nextStageTypeId,
          currentAssigneeId: dto.nextAssigneeId,
          status: SideTaskStatus.ASSIGNED,
        },
      });

      return tx.sideTask.findUnique({
        where: { id },
        include: this.sideTaskInclude,
      });
    });
  }

  /**
   * Reassign current stage to another user
   */
  async reassignStage(id: string, userId: string, dto: ReassignStageDto) {
    return this.prisma.transaction(async (tx) => {
      const task = await tx.sideTask.findUnique({ where: { id } });
      if (!task) throw new NotFoundException('Side task not found');

      const currentHistory = await tx.sideTaskStageHistory.findFirst({
        where: { sideTaskId: id, completedAt: null },
        orderBy: { createdAt: 'desc' },
      });

      if (!currentHistory) {
        throw new BadRequestException('No active stage history found');
      }

      const newAssignee = await tx.user.findUnique({
        where: { id: dto.newAssigneeId },
      });
      if (!newAssignee || !newAssignee.isActive) {
        throw new BadRequestException('New assignee is invalid or inactive');
      }

      const now = new Date();
      const timing = this.finalizeStageTiming(currentHistory, now);

      // Finalize User A's history
      await tx.sideTaskStageHistory.update({
        where: { id: currentHistory.id },
        data: {
          totalTimeSeconds: timing.totalTimeSeconds,
          pausedAt: timing.pausedAt,
          completedAt: now,
          reassignmentReason: dto.reason ?? null,
          outcome: SideTaskStageOutcome.REASSIGNED,
        },
      });

      // Create User B's new stage history (unstarted)
      await tx.sideTaskStageHistory.create({
        data: {
          sideTaskId: id,
          stageTypeId: currentHistory.stageTypeId,
          assignedUserId: dto.newAssigneeId,
        },
      });

      // Update current assignee and set status to ASSIGNED for unstarted stage
      await tx.sideTask.update({
        where: { id },
        data: {
          currentAssigneeId: dto.newAssigneeId,
          status: SideTaskStatus.ASSIGNED,
        },
      });

      return tx.sideTask.findUnique({
        where: { id },
        include: this.sideTaskInclude,
      });
    });
  }

  /**
   * Submit current stage for review
   */
  async submitReview(id: string, userId: string, dto: SubmitReviewDto) {
    return this.prisma.transaction(async (tx) => {
      const task = await tx.sideTask.findUnique({ where: { id } });
      if (!task) throw new NotFoundException('Side task not found');
      if (task.currentAssigneeId !== userId) {
        throw new ForbiddenException('You are not assigned to this task');
      }

      const currentHistory = await tx.sideTaskStageHistory.findFirst({
        where: { sideTaskId: id, completedAt: null },
        orderBy: { createdAt: 'desc' },
      });

      if (!currentHistory) {
        throw new BadRequestException('No active stage history found');
      }

      const now = new Date();
      const timing = this.finalizeStageTiming(currentHistory, now);

      await tx.sideTaskStageHistory.update({
        where: { id: currentHistory.id },
        data: {
          totalTimeSeconds: timing.totalTimeSeconds,
          pausedAt: timing.pausedAt,
          completedAt: now,
          completionNote: dto.completionNote,
          outcome: SideTaskStageOutcome.SUBMITTED_FOR_REVIEW,
        },
      });

      await tx.sideTask.update({
        where: { id },
        data: { status: SideTaskStatus.IN_REVIEW },
      });

      return tx.sideTask.findUnique({
        where: { id },
        include: this.sideTaskInclude,
      });
    });
  }

  /**
   * Approve review -> completes task
   */
  async approveReview(id: string, reviewerId: string) {
    return this.prisma.transaction(async (tx) => {
      const task = await tx.sideTask.findUnique({ where: { id } });
      if (!task) throw new NotFoundException('Side task not found');
      if (task.status !== SideTaskStatus.IN_REVIEW) {
        throw new BadRequestException('Task is not in review');
      }

      const now = new Date();
      await tx.sideTask.update({
        where: { id },
        data: {
          status: SideTaskStatus.COMPLETED,
          completedAt: now,
        },
      });

      return tx.sideTask.findUnique({
        where: { id },
        include: this.sideTaskInclude,
      });
    });
  }

  /**
   * Send back review -> returns task to ASSIGNED with optional target user
   */
  async sendBackReview(id: string, reviewerId: string, dto: SendBackReviewDto) {
    return this.prisma.transaction(async (tx) => {
      const task = await tx.sideTask.findUnique({ where: { id } });
      if (!task) throw new NotFoundException('Side task not found');
      if (task.status !== SideTaskStatus.IN_REVIEW) {
        throw new BadRequestException('Task is not in review');
      }

      // Fetch last completed history before review
      const lastHistory = await tx.sideTaskStageHistory.findFirst({
        where: { sideTaskId: id, outcome: SideTaskStageOutcome.SUBMITTED_FOR_REVIEW },
        orderBy: { createdAt: 'desc' },
      });

      if (!lastHistory) {
        throw new BadRequestException('No previous review submission history found');
      }

      // Resolve target user (explicitly provided or previous assignee)
      const targetUserId = dto.assignedUserId ?? lastHistory.assignedUserId;
      const targetUser = await tx.user.findUnique({ where: { id: targetUserId } });
      if (!targetUser || !targetUser.isActive) {
        throw new BadRequestException('Target assigned user is invalid or inactive');
      }

      // Create new stage history record for returned task (unstarted state)
      await tx.sideTaskStageHistory.create({
        data: {
          sideTaskId: id,
          stageTypeId: lastHistory.stageTypeId,
          assignedUserId: targetUserId,
          reviewReturnReason: dto.reason,
          outcome: SideTaskStageOutcome.RETURNED,
        },
      });

      await tx.sideTask.update({
        where: { id },
        data: {
          currentAssigneeId: targetUserId,
          currentStageTypeId: lastHistory.stageTypeId,
          status: SideTaskStatus.ASSIGNED,
        },
      });

      return tx.sideTask.findUnique({
        where: { id },
        include: this.sideTaskInclude,
      });
    });
  }

  /**
   * Abandon task
   */
  async abandonTask(id: string, userId: string, dto: AbandonSideTaskDto) {
    return this.prisma.transaction(async (tx) => {
      const task = await tx.sideTask.findUnique({ where: { id } });
      if (!task) throw new NotFoundException('Side task not found');

      const currentHistory = await tx.sideTaskStageHistory.findFirst({
        where: { sideTaskId: id, completedAt: null },
        orderBy: { createdAt: 'desc' },
      });

      const now = new Date();
      if (currentHistory) {
        const timing = this.finalizeStageTiming(currentHistory, now);
        await tx.sideTaskStageHistory.update({
          where: { id: currentHistory.id },
          data: {
            totalTimeSeconds: timing.totalTimeSeconds,
            pausedAt: timing.pausedAt,
            completedAt: now,
            outcome: SideTaskStageOutcome.ABANDONED,
          },
        });
      }

      await tx.sideTask.update({
        where: { id },
        data: {
          status: SideTaskStatus.ABANDONED,
          abandonedAt: now,
        },
      });

      return tx.sideTask.findUnique({
        where: { id },
        include: this.sideTaskInclude,
      });
    });
  }

  /**
   * Delete a side task by ID and remove its images from Cloudflare R2
   */
  async delete(id: string) {
    const task = await this.prisma.sideTask.findUnique({
      where: { id },
    });

    if (!task) {
      throw new NotFoundException('Side task not found');
    }

    if (task.images && task.images.length > 0) {
      try {
        await this.cloudflare.deleteFiles(task.images);
        this.logger.log(
          `Deleted ${task.images.length} image(s) from Cloudflare for task ${id}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to delete images from Cloudflare for task ${id}`,
          error,
        );
      }
    }

    await this.prisma.sideTask.delete({
      where: { id },
    });

    return { message: 'Side task deleted successfully', id };
  }
}
