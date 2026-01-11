import {
    BadRequestException,
    Injectable,
    Logger,
    NotFoundException,
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

    // ✅ FIX: wrapped inside a method
    async create(dto: CreateProcessDto) {
        return this.prisma.process.create({
            data: {
                name: dto.name,
                description: dto.description,
                isEnabled: dto.isEnabled ?? false,

                // 👇 REQUIRED relation
                workflowType: {
                    connect: {
                        id: dto.workflowTypeId,
                    },
                },

                runDefs: {
                    create: dto.runDefinitions.map(d => ({
                        displayName: d.displayName,
                        runTemplateId: d.runTemplateId,
                        sortOrder: d.sortOrder,
                    })),
                },
            },
            include: {
                workflowType: {
                    include: {
                        statuses: {
                            orderBy: { createdAt: 'asc' }, select: {
                                id: true,
                                code: true,
                            },
                        },
                    },
                },
                runDefs: {
                    include: { runTemplate: true },
                    orderBy: { sortOrder: 'asc' },
                },
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
                workflowType: {
                    include: {
                        statuses: {
                            orderBy: { createdAt: 'asc' }, select: {
                                id: true,
                                code: true,
                            }
                        },
                    },
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
                workflowType: {
                    include: {
                        statuses: {
                            orderBy: { createdAt: 'asc' }, 
                            select: {
                                id: true,
                                code: true,
                            }
                        },
                    },
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

    async getProcessRun(orderProcessId: string, processRunId: string) {
        const run = await this.prisma.processRun.findFirst({
            where: {
                id: processRunId,
                orderProcessId,
            },
            include: {
                runTemplate: {
                    select: {
                        fields: true,
                    },
                },
            },
        });

        if (!run) {
            throw new NotFoundException('Process run not found');
        }

        return {
            id: run.id,
            statusCode: run.statusCode,
            fields: run.fields,
            fieldSchema: run.runTemplate.fields,
        };
    }

    async configure(
        orderProcessId: string,
        processRunId: string,
        dto: ConfigureProcessRunDto,
    ) {
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

        this.validateFields(
            run.runTemplate.fields as TemplateField[],
            dto.fields,
        );

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
