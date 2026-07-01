import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminProcessService } from '../processes/admin-process.service';
import { ManagerQueueService } from './manager-queue.service';

const mockTx = {
  processRun: {
    findUnique: jest.fn(),
    updateMany: jest.fn(),
    update: jest.fn(),
  },
  managerStagePermission: { findFirst: jest.fn() },
  runTemplate: { findUnique: jest.fn() },
  workflowStatus: { findMany: jest.fn() },
  processRunStageHistory: { create: jest.fn() },
};

const mockPrisma = {
  managerStagePermission: { findMany: jest.fn() },
  processRun: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  transaction: jest.fn((fn: (tx: any) => Promise<any>) => fn(mockTx)),
} as unknown as jest.Mocked<PrismaService>;

const mockAdminProcessService = {
  transition: jest.fn(),
} as unknown as jest.Mocked<AdminProcessService>;

function makeService() {
  return new ManagerQueueService(mockPrisma, mockAdminProcessService);
}

describe('ManagerQueueService', () => {
  let svc: ManagerQueueService;

  beforeEach(() => {
    jest.clearAllMocks();
    svc = makeService();
  });

  describe('claim', () => {
    it('throws BadRequestException when run does not exist', async () => {
      mockTx.processRun.findUnique.mockResolvedValue(null);
      await expect(svc.claim('mgr-1', 'run-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws ForbiddenException when manager lacks stage permission', async () => {
      mockTx.processRun.findUnique.mockResolvedValue({
        id: 'run-1',
        lifeCycleStatusCode: 'PRODUCTION',
        orderProcess: { processId: 'proc-1' },
      });
      mockTx.managerStagePermission.findFirst.mockResolvedValue(null);

      await expect(svc.claim('mgr-1', 'run-1')).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockTx.processRun.updateMany).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the run was already claimed', async () => {
      mockTx.processRun.findUnique.mockResolvedValue({
        id: 'run-1',
        lifeCycleStatusCode: 'PRODUCTION',
        orderProcess: { processId: 'proc-1' },
      });
      mockTx.managerStagePermission.findFirst.mockResolvedValue({ id: 'p1' });
      mockTx.processRun.updateMany.mockResolvedValue({ count: 0 });

      await expect(svc.claim('mgr-1', 'run-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('claims successfully when permitted and unclaimed', async () => {
      mockTx.processRun.findUnique.mockResolvedValue({
        id: 'run-1',
        lifeCycleStatusCode: 'PRODUCTION',
        orderProcess: { processId: 'proc-1' },
      });
      mockTx.managerStagePermission.findFirst.mockResolvedValue({ id: 'p1' });
      mockTx.processRun.updateMany.mockResolvedValue({ count: 1 });

      await expect(svc.claim('mgr-1', 'run-1')).resolves.toBeUndefined();
      expect(mockTx.processRun.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'run-1', claimedBy: null },
        }),
      );
    });
  });

  describe('release', () => {
    it('throws ForbiddenException when caller does not hold the claim', async () => {
      (mockPrisma.processRun.findUnique as jest.Mock).mockResolvedValue({
        claimedBy: 'someone-else',
      });
      await expect(svc.release('mgr-1', 'run-1')).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrisma.processRun.update).not.toHaveBeenCalled();
    });

    it('clears the claim when caller holds it', async () => {
      (mockPrisma.processRun.findUnique as jest.Mock).mockResolvedValue({
        claimedBy: 'mgr-1',
      });
      await svc.release('mgr-1', 'run-1');
      expect(mockPrisma.processRun.update).toHaveBeenCalledWith({
        where: { id: 'run-1' },
        data: { claimedBy: null, claimedAt: null },
      });
    });
  });

  describe('forceRelease', () => {
    it('clears the claim regardless of owner', async () => {
      (mockPrisma.processRun.findUnique as jest.Mock).mockResolvedValue({
        claimedBy: 'mgr-1',
      });
      await svc.forceRelease('admin-1', 'run-1');
      expect(mockPrisma.processRun.update).toHaveBeenCalledWith({
        where: { id: 'run-1' },
        data: { claimedBy: null, claimedAt: null },
      });
    });
  });

  describe('complete', () => {
    it('throws ForbiddenException when caller does not hold the claim', async () => {
      mockTx.processRun.findUnique.mockResolvedValue({
        id: 'run-1',
        claimedBy: 'someone-else',
      });
      await expect(svc.complete('mgr-1', 'run-1')).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockAdminProcessService.transition).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when run is already at its final stage', async () => {
      mockTx.processRun.findUnique.mockResolvedValue({
        id: 'run-1',
        orderProcessId: 'op-1',
        runTemplateId: 'rt-1',
        lifeCycleStatusCode: 'COMPLETE',
        claimedBy: 'mgr-1',
        claimedAt: new Date(),
        orderProcess: { processId: 'proc-1' },
      });
      mockTx.runTemplate.findUnique.mockResolvedValue({
        lifecycleWorkflowTypeId: 'wf-1',
      });
      mockTx.workflowStatus.findMany.mockResolvedValue([
        { id: 's1', code: 'PRODUCTION', isTerminal: false },
        { id: 's2', code: 'COMPLETE', isTerminal: true },
      ]);

      await expect(svc.complete('mgr-1', 'run-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('advances via AdminProcessService.transition, sets executorId, clears claim, records history', async () => {
      const claimedAt = new Date(Date.now() - 60_000);
      mockTx.processRun.findUnique.mockResolvedValue({
        id: 'run-1',
        orderProcessId: 'op-1',
        runTemplateId: 'rt-1',
        lifeCycleStatusCode: 'PRODUCTION',
        claimedBy: 'mgr-1',
        claimedAt,
        orderProcess: { processId: 'proc-1' },
      });
      mockTx.runTemplate.findUnique.mockResolvedValue({
        lifecycleWorkflowTypeId: 'wf-1',
      });
      mockTx.workflowStatus.findMany.mockResolvedValue([
        { id: 's1', code: 'PRODUCTION', isTerminal: false },
        { id: 's2', code: 'WAITING', isTerminal: false },
      ]);
      (mockAdminProcessService.transition as jest.Mock).mockResolvedValue({
        success: true,
        status: 'WAITING',
      });

      const result = await svc.complete('mgr-1', 'run-1');

      expect(mockAdminProcessService.transition).toHaveBeenCalledWith(
        'op-1',
        'run-1',
        'WAITING',
        undefined,
        mockTx,
      );
      expect(mockTx.processRun.update).toHaveBeenCalledWith({
        where: { id: 'run-1' },
        data: { executorId: 'mgr-1', claimedBy: null, claimedAt: null },
      });
      expect(mockTx.processRunStageHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            processRunId: 'run-1',
            processId: 'proc-1',
            lifecycleStageId: 's1',
            managerId: 'mgr-1',
          }),
        }),
      );
      expect(result).toEqual({ success: true, status: 'WAITING' });
    });
  });
});
