import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { SideTasksService } from './side-tasks.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CloudflareService } from '../common/cloudflare.service';
import { SideTaskPriority, SideTaskStageOutcome, SideTaskStatus } from '@prisma/client';

describe('SideTasksService', () => {
  let service: SideTasksService;
  let prisma: any;
  let cloudflare: any;

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
      delete: jest.fn(),
    },
    sideTaskStageHistory: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    transaction: jest.fn((callback) => callback(mockPrismaService)),
  };

  const mockCloudflareService: any = {
    deleteFiles: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SideTasksService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: CloudflareService, useValue: mockCloudflareService },
      ],
    }).compile();

    service = module.get<SideTasksService>(SideTasksService);
    prisma = module.get<PrismaService>(PrismaService);
    cloudflare = module.get<CloudflareService>(CloudflareService);
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
  });

  describe('delete', () => {
    it('should throw NotFoundException if task does not exist', async () => {
      mockPrismaService.sideTask.findUnique.mockResolvedValue(null);
      await expect(service.delete('non-existent')).rejects.toThrow(NotFoundException);
    });

    it('should delete images from Cloudflare and delete task from DB', async () => {
      mockPrismaService.sideTask.findUnique.mockResolvedValue({
        id: 'task-1',
        images: ['http://cf.com/img1.png', 'http://cf.com/img2.png'],
      });
      mockPrismaService.sideTask.delete.mockResolvedValue({ id: 'task-1' });

      const res = await service.delete('task-1');

      expect(mockCloudflareService.deleteFiles).toHaveBeenCalledWith([
        'http://cf.com/img1.png',
        'http://cf.com/img2.png',
      ]);
      expect(mockPrismaService.sideTask.delete).toHaveBeenCalledWith({
        where: { id: 'task-1' },
      });
      expect(res).toEqual({ message: 'Side task deleted successfully', id: 'task-1' });
    });
  });
});

