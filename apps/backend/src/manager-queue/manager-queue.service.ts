import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { ManagerActiveJobDto, ManagerQueueItemDto } from '@app/contracts';
import { Prisma } from '@prisma/client';
import { PrismaExecutor, PrismaService } from '../../prisma/prisma.service';
import { ContextLogger } from '../common/logger/context.logger';
import { AdminProcessService } from '../processes/admin-process.service';

const QUANTITY_FIELD_CANDIDATES = [
  'Quantity',
  'Total Quantity',
  'pcs',
  'total_quantity',
];

@Injectable()
export class ManagerQueueService {
  private readonly logger = new ContextLogger(ManagerQueueService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly adminProcessService: AdminProcessService,
  ) {}

  /* ---------------- HELPERS ---------------- */

  private resolveQuantity(fields: Record<string, any> | null): number | null {
    if (!fields) return null;
    for (const key of QUANTITY_FIELD_CANDIDATES) {
      const value = fields[key];
      if (typeof value === 'number' && !Number.isNaN(value)) return value;
      if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        if (!Number.isNaN(parsed)) return parsed;
      }
    }
    return null;
  }

  private resolveArtworkUrl(
    fields: Record<string, any> | null,
    orderImages: string[],
  ): string | null {
    const runImages = fields?.images;
    if (Array.isArray(runImages) && runImages.length > 0) return runImages[0];
    if (Array.isArray(orderImages) && orderImages.length > 0)
      return orderImages[0];
    return null;
  }

  private toQueueItemDto(run: {
    id: string;
    runNumber: number;
    lifeCycleStatusCode: string;
    comments: string | null;
    fields: any;
    createdAt: Date;
    orderProcess: {
      process: { name: string };
      order: {
        id: string;
        code: string;
        images: string[];
        customer: { name: string };
      };
    };
  }): ManagerQueueItemDto {
    const fields = (run.fields as Record<string, any>) || null;
    return {
      id: run.id,
      runNumber: run.runNumber,
      orderId: run.orderProcess.order.id,
      orderCode: run.orderProcess.order.code,
      customerName: run.orderProcess.order.customer.name,
      quantity: this.resolveQuantity(fields),
      processName: run.orderProcess.process.name,
      lifeCycleStatusCode: run.lifeCycleStatusCode,
      comments: run.comments,
      artworkUrl: this.resolveArtworkUrl(fields, run.orderProcess.order.images),
      createdAt: run.createdAt.toISOString(),
    };
  }

  private readonly queueItemInclude = {
    orderProcess: {
      include: {
        process: { select: { name: true } },
        order: {
          select: {
            id: true,
            code: true,
            images: true,
            customer: { select: { name: true } },
          },
        },
      },
    },
  } satisfies Prisma.ProcessRunInclude;

  /* ---------------- QUERIES ---------------- */

  async listQueue(managerId: string): Promise<ManagerQueueItemDto[]> {
    const permissions = await this.prisma.managerStagePermission.findMany({
      where: { managerId },
      include: { lifecycleStage: { select: { code: true } } },
    });

    if (permissions.length === 0) return [];

    const grouped = new Map<string, string[]>();
    for (const p of permissions) {
      const codes = grouped.get(p.processId) ?? [];
      codes.push(p.lifecycleStage.code);
      grouped.set(p.processId, codes);
    }

    const runs = await this.prisma.processRun.findMany({
      where: {
        claimedBy: null,
        // statusCode is the config-workflow status (CONFIGURE -> COMPLETE);
        // it's never set to IN_PROGRESS anywhere. COMPLETE means the run's
        // fields are configured and it's ready for lifecycle work — the
        // actual production stage is tracked separately by lifeCycleStatusCode.
        statusCode: 'COMPLETE',
        orderProcess: {
          order: { statusCode: 'IN_PRODUCTION', deletedAt: null },
        },
        OR: Array.from(grouped.entries()).map(([processId, codes]) => ({
          orderProcess: { processId },
          lifeCycleStatusCode: { in: codes },
        })),
      },
      include: this.queueItemInclude,
      orderBy: { createdAt: 'asc' },
    });

    return runs.map((r) => this.toQueueItemDto(r));
  }

  async listActive(managerId: string): Promise<ManagerActiveJobDto[]> {
    const runs = await this.prisma.processRun.findMany({
      where: { claimedBy: managerId },
      include: this.queueItemInclude,
      orderBy: { claimedAt: 'asc' },
    });

    return runs.map((r) => ({
      ...this.toQueueItemDto(r),
      claimedAt: (r as any).claimedAt.toISOString(),
    }));
  }

  /* ---------------- ACTIONS ---------------- */

  async claim(managerId: string, runId: string): Promise<void> {
    await this.prisma.transaction(async (tx) => {
      const run = await tx.processRun.findUnique({
        where: { id: runId },
        select: {
          id: true,
          lifeCycleStatusCode: true,
          orderProcess: { select: { processId: true } },
        },
      });

      if (!run) {
        throw new BadRequestException('Run not found');
      }

      const permitted = await tx.managerStagePermission.findFirst({
        where: {
          managerId,
          processId: run.orderProcess.processId,
          lifecycleStage: { code: run.lifeCycleStatusCode },
        },
        select: { id: true },
      });

      if (!permitted) {
        throw new ForbiddenException(
          'You are not permitted to claim this stage',
        );
      }

      const result = await tx.processRun.updateMany({
        where: { id: runId, claimedBy: null },
        data: { claimedBy: managerId, claimedAt: new Date() },
      });

      if (result.count === 0) {
        throw new ConflictException('Run already claimed');
      }
    });

    this.logger.log(`Run claimed runId=${runId} managerId=${managerId}`);
  }

  async release(managerId: string, runId: string): Promise<void> {
    const run = await this.prisma.processRun.findUnique({
      where: { id: runId },
      select: { claimedBy: true },
    });

    if (!run) {
      throw new BadRequestException('Run not found');
    }

    if (run.claimedBy !== managerId) {
      throw new ForbiddenException('You do not hold this claim');
    }

    await this.prisma.processRun.update({
      where: { id: runId },
      data: { claimedBy: null, claimedAt: null },
    });

    this.logger.log(`Run released runId=${runId} managerId=${managerId}`);
  }

  async forceRelease(adminId: string, runId: string): Promise<void> {
    const run = await this.prisma.processRun.findUnique({
      where: { id: runId },
      select: { claimedBy: true },
    });

    if (!run) {
      throw new BadRequestException('Run not found');
    }

    await this.prisma.processRun.update({
      where: { id: runId },
      data: { claimedBy: null, claimedAt: null },
    });

    this.logger.warn(
      `Claim force-released runId=${runId} previousClaimant=${run.claimedBy ?? 'none'} by admin=${adminId}`,
    );
  }

  async complete(
    managerId: string,
    runId: string,
  ): Promise<{ success: true; status: string }> {
    return this.prisma.transaction(async (tx) => {
      const run = await tx.processRun.findUnique({
        where: { id: runId },
        select: {
          id: true,
          orderProcessId: true,
          runTemplateId: true,
          lifeCycleStatusCode: true,
          claimedBy: true,
          claimedAt: true,
          orderProcess: { select: { processId: true } },
        },
      });

      if (!run) {
        throw new BadRequestException('Run not found');
      }

      if (run.claimedBy !== managerId) {
        throw new ForbiddenException('You do not hold this claim');
      }

      const template = await tx.runTemplate.findUnique({
        where: { id: run.runTemplateId },
        select: { lifecycleWorkflowTypeId: true },
      });

      if (!template) {
        throw new BadRequestException('RunTemplate missing');
      }

      // Same ordering AdminProcessService uses to build the lifecycle progress
      // array (WorkflowStatus rows ordered by createdAt) — "next stage" is
      // simply the following entry, matching existing UI behavior exactly.
      const statuses = await tx.workflowStatus.findMany({
        where: { workflowTypeId: template.lifecycleWorkflowTypeId },
        orderBy: { createdAt: 'asc' },
        select: { id: true, code: true, isTerminal: true },
      });

      const currentIndex = statuses.findIndex(
        (s) => s.code === run.lifeCycleStatusCode,
      );

      if (currentIndex === -1) {
        throw new BadRequestException('Invalid current lifecycle state');
      }

      const currentStage = statuses[currentIndex];
      const nextStage = statuses[currentIndex + 1];

      if (!nextStage) {
        throw new BadRequestException('Run already at its final stage');
      }

      await this.adminProcessService.transition(
        run.orderProcessId,
        run.id,
        nextStage.code,
        undefined,
        tx,
      );

      const completedAt = new Date();
      const claimedAt = run.claimedAt as Date;

      await tx.processRun.update({
        where: { id: run.id },
        data: { executorId: managerId, claimedBy: null, claimedAt: null },
      });

      await tx.processRunStageHistory.create({
        data: {
          processRunId: run.id,
          processId: run.orderProcess.processId,
          lifecycleStageId: currentStage.id,
          managerId,
          claimedAt,
          completedAt,
          durationSeconds: Math.round(
            (completedAt.getTime() - claimedAt.getTime()) / 1000,
          ),
        },
      });

      this.logger.log(
        `Stage completed runId=${runId} managerId=${managerId} ${currentStage.code} -> ${nextStage.code}`,
      );

      return { success: true as const, status: nextStage.code };
    });
  }
}
