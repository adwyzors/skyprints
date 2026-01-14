
import { CreateProcessDto } from '../../../packages/contracts/dist/process.contract';

import {
    BadRequestException,
    Injectable,
    Logger
} from '@nestjs/common';
import { ConfigureProcessRunDto, TransitionProcessRunDto } from '../../../packages/contracts/dist/process-run.configure.contract';
import { RunTemplateField } from '../../../packages/contracts/dist/run-template.contract';
import { PrismaService } from '../../prisma/prisma.service';
import { toProcessSummary } from '../mappers/process.mapper';


@Injectable()
export class AdminProcessService {
    private readonly logger = new Logger(AdminProcessService.name);

    constructor(
        private readonly prisma: PrismaService,
    ) { }

    async create(dto: CreateProcessDto) {
        return this.prisma.$transaction(async tx => {

            // 1. Validate run templates exist
            const templates = await tx.runTemplate.findMany({
                where: {
                    id: { in: dto.runs.map(r => r.runTemplateId) },
                },
                select: {
                    id: true,
                },
            });

            if (templates.length !== dto.runs.length) {
                throw new BadRequestException('One or more RunTemplates not found');
            }

            // 2. Create Process (PURE CONFIG)
            const process = await tx.process.create({
                data: {
                    name: dto.name,
                    description: dto.description,
                    isEnabled: dto.isEnabled,
                },
            });

            // 3. Create mappings
            await tx.processRunDefinition.createMany({
                data: dto.runs.map(run => ({
                    processId: process.id,
                    runTemplateId: run.runTemplateId,
                    displayName: run.displayName,
                    sortOrder: run.sortOrder,
                })),
            });

            return process;
        });
    }


    async getById(id: string) {
        const process = await this.prisma.process.findUnique({
            where: { id },
            include: {
                runDefs: {
                    orderBy: { sortOrder: 'asc' },
                    include: {
                        runTemplate: {
                            select: {
                                id: true,
                                name: true,
                                fields: true,
                                lifecycleWorkflowType: {
                                    select: {
                                        id: true,
                                        statuses: {
                                            orderBy: [{ isInitial: 'desc' }],
                                            select: {
                                                code: true,
                                                isInitial: true,
                                                isTerminal: true,
                                            },
                                        },
                                    },
                                },
                            },
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


    async getAll() {
        const processes = await this.prisma.process.findMany({
            include: {
                runDefs: {
                    select: { id: true },
                },
            },
            orderBy: { name: 'asc' }, // Process has no createdAt in your model
        });

        return processes.map(toProcessSummary);
    }

    //async requestOrderProcessTransition(orderProcessId: string) {
    //    const orderProcess = await this.prisma.orderProcess.findUnique({
    //        where: { id: orderProcessId },
    //    });

    //    if (!orderProcess) {
    //        throw new NotFoundException('OrderProcess not found');
    //    }

    //    this.logger.log(
    //        `OrderProcess ${orderProcessId} requesting status transition from ${orderProcess.statusCode}`,
    //    );

    //    await this.prisma.outboxEvent.create({
    //        data: {
    //            aggregateType: 'OrderProcess',
    //            aggregateId: orderProcess.id,
    //            eventType: 'ORDER_PROCESS_STATUS_TRANSITION_REQUESTED',
    //            payload: {
    //            },
    //        },
    //    });

    //    return { success: true };
    //}


    //async getProcessRun(orderProcessId: string, processRunId: string) {
    //    const run = await this.prisma.processRun.findFirst({
    //        where: {
    //            id: processRunId,
    //            orderProcessId,
    //        },
    //        include: {
    //            runTemplate: {
    //                include: {
    //                    workflowType: {
    //                        include: {
    //                            statuses: true,
    //                        },
    //                    },
    //                },
    //            },
    //        },
    //    });


    //    if (!run) {
    //        throw new NotFoundException('Process run not found');
    //    }

    //    return {
    //        id: run.id,
    //        statusCode: run.statusCode,
    //        fields: run.fields,
    //        fieldSchema: run.runTemplate.fields,
    //    };
    //}

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
            include: {
                runTemplate: {
                    include: {
                        configWorkflowType: {
                            include: {
                                statuses: true,
                            },
                        },
                    },
                },
            },
        });

        if (!run) {
            throw new BadRequestException('Invalid process run');
        }

        /* ---------------- CONFIG WORKFLOW ---------------- */

        const configWorkflow = run.runTemplate.configWorkflowType;

        const initialConfigStatus =
            configWorkflow.statuses.find(s => s.isInitial);

        if (!initialConfigStatus) {
            throw new BadRequestException(
                'RunTemplate config workflow not initialized',
            );
        }

        if (run.statusCode !== initialConfigStatus.code) {
            throw new BadRequestException(
                `Configuration allowed only in initial config status (${initialConfigStatus.code})`,
            );
        }

        /* ---------------- VALIDATE FIELDS ---------------- */

        this.validateFields(
            run.runTemplate.fields as RunTemplateField[],
            dto.fields,
        );

        /* ---------------- TRANSACTION ---------------- */

        return this.prisma.$transaction(async tx => {
            // 1️⃣ save configuration
            await tx.processRun.update({
                where: { id: run.id },
                data: {
                    fields: dto.fields,
                },
            });

            // 2️⃣ request CONFIG transition
            await tx.outboxEvent.create({
                data: {
                    aggregateType: 'ProcessRun',
                    aggregateId: run.id,
                    eventType: 'PROCESS_RUN_CONFIG_TRANSITION_REQUESTED',
                    payload: {},
                },
            });

            return { success: true };
        });
    }

    async transition(
        orderProcessId: string,
        processRunId: string,
        dto: TransitionProcessRunDto,
    ) {
        const run = await this.prisma.processRun.findFirst({
            where: {
                id: processRunId,
                orderProcessId,
            },
            include: {
                runTemplate: {
                    include: {
                        lifecycleWorkflowType: {
                            include: {
                                statuses: true,
                            },
                        },
                    },
                },
            },
        });

        if (!run) {
            throw new BadRequestException('Invalid process run');
        }


        /* ---------------- VALIDATE FIELDS ---------------- */

        this.validateFields(
            run.runTemplate.fields as RunTemplateField[],
            dto.fields,
        );

        /* ---------------- TRANSACTION ---------------- */

        return this.prisma.$transaction(async tx => {
            await tx.processRun.update({
                where: { id: run.id },
                data: {
                    fields: dto.fields,
                },
            });

            // request transition
            await tx.outboxEvent.create({
                data: {
                    aggregateType: 'ProcessRun',
                    aggregateId: run.id,
                    eventType: 'PROCESS_RUN_LIFECYCLE_TRANSITION_REQUESTED',
                    payload: {},
                },
            });

            return { success: true };
        });
    }


    private validateFields(
        templateFields: RunTemplateField[],
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
