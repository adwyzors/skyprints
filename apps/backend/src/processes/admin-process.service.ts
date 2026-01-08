import {
    BadRequestException,
    Injectable,
    Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProcessDto } from './dto/create-process.dto';

@Injectable()
export class AdminProcessService {
    private readonly logger = new Logger(AdminProcessService.name);

    constructor(
        private readonly prisma: PrismaService,
    ) { }

    async create(dto: CreateProcessDto) {
        const templateIds = dto.runDefinitions.map(d => d.runTemplateId);

        const templates = await this.prisma.runTemplate.findMany({
            where: { id: { in: templateIds } },
        });

        if (templates.length !== templateIds.length) {
            throw new BadRequestException('Invalid run template detected');
        }

        return this.prisma.process.create({
            data: {
                name: dto.name,
                description: dto.description,
                isEnabled: dto.isEnabled ?? false,
                runDefs: {
                    create: dto.runDefinitions.map(d => ({
                        displayName: d.displayName,
                        runTemplateId: d.runTemplateId,
                        sortOrder: d.sortOrder,
                    })),
                },
            },
            include: {
                runDefs: { include: { runTemplate: true } },
            },
        });
    }


    async getById(processId: string) {
        const process = await this.prisma.process.findUnique({
            where: { id: processId },
            include: {
                runDefs: {
                    include: { runTemplate: true },
                    orderBy: { sortOrder: 'asc' },
                },
            },
        });

        if (!process) {
            throw new BadRequestException('Process not found');
        }

        return process;
    }

    async list() {
        return this.prisma.process.findMany({
            include: {
                runDefs: {
                    include: { runTemplate: true },
                    orderBy: { sortOrder: 'asc' },
                },
            },
        });
    }

    async enable(processId: string) {
        return this.prisma.process.update({
            where: { id: processId },
            data: { isEnabled: true },
        });
    }

    async disable(processId: string) {
        return this.prisma.process.update({
            where: { id: processId },
            data: { isEnabled: false },
        });
    }
}
