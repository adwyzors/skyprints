import {
    BadRequestException,
    Injectable,
    Logger,
} from '@nestjs/common';
import { TemplateField } from 'src/workflow/types/template-field.type';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigureProcessRunDto } from './dto/configure-process-run.dto';
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

    async configure(
        orderProcessId: string,
        processRunId: string,
        dto: ConfigureProcessRunDto,
    ) {
        /**
         * 1. Load ProcessRun + Template (NO TX)
         */
        const run = await this.prisma.processRun.findFirst({
            where: {
                id: processRunId,
                orderProcessId,
            },
            include: { runTemplate: true },
        });

        if (!run) {
            throw new BadRequestException('Invalid process run');
        }

        /**
         * 2. Resolve RUN workflow initial status (NO TX)
         */
        const initialStatus = await this.prisma.workflowStatus.findFirstOrThrow({
            where: {
                workflowType: { code: 'RUN' },
                isInitial: true,
            },
        });

        if (run.statusCode !== initialStatus.code) {
            throw new BadRequestException(
                `Configuration allowed only in initial status (${initialStatus.code})`,
            );
        }

        /**
         * 3. Validate fields (NO TX)
         */
        this.validateFields(
            run.runTemplate.fields as TemplateField[],
            dto.fields,
        );

        /**
         * 4. ATOMIC WRITE TRANSACTION
         */
        return this.prisma.$transaction(async tx => {
            await tx.processRun.update({
                where: { id: run.id },
                data: { fields: dto.fields },
            });

            await tx.outboxEvent.create({
                data: {
                    aggregateType: 'Run',
                    aggregateId: run.id,
                    eventType: 'PROCESS_RUN_STATUS_TRANSITION_REQUESTED',
                    payload: {
                        workflowTypeCode: 'RUN',
                    },
                },
            });

            return { success: true };
        });
    }

    private validateFields(
        templateFields: TemplateField[],
        inputFields: Record<string, any>,
    ) {
        const templateMap = new Map(
            templateFields.map(f => [f.key, f]),
        );

        for (const field of templateFields) {
            if (field.required && !(field.key in inputFields)) {
                throw new BadRequestException(
                    `Missing required field: ${field.key}`,
                );
            }
        }

        for (const key of Object.keys(inputFields)) {
            if (!templateMap.has(key)) {
                throw new BadRequestException(`Unknown field: ${key}`);
            }
        }

        for (const [key, value] of Object.entries(inputFields)) {
            const expected = templateMap.get(key)!;
            if (typeof value !== expected.type) {
                throw new BadRequestException(
                    `Invalid type for ${key}, expected ${expected.type}`,
                );
            }
        }
    }


}
