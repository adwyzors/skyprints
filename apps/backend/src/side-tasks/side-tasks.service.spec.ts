import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { SideTasksService } from './side-tasks.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SideTaskPriority, SideTaskStageOutcome, SideTaskStatus } from '@prisma/client';

describe('SideTasksService', () => {
  let service: SideTasksService;
  let prisma: any;

  const mockPrismaService: any = {
    sideTaskStageType: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    customer: {
      findUnique: jest.fn(),
    },
    sideTask: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    sideTaskStageHistory: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    transaction: jest.fn((callback) => callback(mockPrismaService)),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SideTasksService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<SideTasksService>(SideTasksService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('create', () => {
    it('should throw BadRequestException if images array exceeds 2', async () => {
      await expect(
        service.create('user-1', {
          title: 'Test Task',
          initialStageTypeId: 'stage-1',
          initialAssigneeId: 'user-2',
          images: ['img1.png', 'img2.png', 'img3.png'],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if initial stage type is invalid or inactive', async () => {
      mockPrismaService.sideTaskStageType.findUnique.mockResolvedValue(null);

      await expect(
        service.create('user-1', {
          title: 'Test Task',
          initialStageTypeId: 'invalid-stage',
          initialAssigneeId: 'user-2',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('startStage', () => {
    it('should throw ForbiddenException if current user is not the assignee', async () => {
      mockPrismaService.sideTask.findUnique.mockResolvedValue({
        id: 'task-1',
        currentAssigneeId: 'user-99',
        status: SideTaskStatus.ASSIGNED,
      });

      await expect(service.startStage('task-1', 'user-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw BadRequestException if user already has an active running timer on another task', async () => {
      mockPrismaService.sideTask.findUnique.mockResolvedValue({
        id: 'task-1',
        currentAssigneeId: 'user-1',
        status: SideTaskStatus.ASSIGNED,
      });

      mockPrismaService.sideTaskStageHistory.findFirst
        .mockResolvedValueOnce({ id: 'history-1', sideTaskId: 'task-1', startedAt: null }) // current stage history
        .mockResolvedValueOnce({ id: 'history-other', sideTaskId: 'task-2' }); // active running timer check

      await expect(service.startStage('task-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
