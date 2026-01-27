import {
    ConfigureProcessRunDto,
    CreateProcessDto,
    RunTemplateField,
} from '@app/contracts';
import {
    BadRequestException,
    Injectable,
    NotFoundException
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CloudflareService } from '../common/cloudflare.service';
import { ContextLogger } from '../common/logger/context.logger';
import { toProcessSummary } from '../mappers/process.mapper';
import { OrdersService } from '../orders/orders.service';
type SystemFieldValidator = (value: any) => boolean;

@Injectable()
export class AdminProcessService {
    private readonly logger = new ContextLogger(AdminProcessService.name);
    private static readonly SYSTEM_FIELDS = new Set<string>([
        'images',
    ]);


    private static readonly SYSTEM_FIELD_VALIDATORS: Record<
        string,
        (value: any) => any
    > = {
            images: (v: any) => {
                if (v == null) return undefined; // ignore if absent

                // normalize single URL → array
                if (typeof v === 'string') {
                    return [v];
                }

                if (Array.isArray(v) && v.every(i => typeof i === 'string')) {
                    return v;
                }

                return null; // invalid
            },
        };



    constructor(private readonly prisma: PrismaService,
        private readonly orderService: OrdersService,
        private readonly cloudflare: CloudflareService,
    ) { }

    /* =========================================================
     * PROCESS CRUD
     * ========================================================= */

    async create(dto: CreateProcessDto) {
        this.logger.log(`[PROCESS][CREATE] name=${dto.name}`);

        return this.prisma.transaction(async tx => {
            const process = await tx.process.create({
                data: {
                    name: dto.name,
                    description: dto.description,
                    isEnabled: dto.isEnabled,
                },
            });

            await tx.processRunDefinition.createMany({
                data: dto.runs.map(r => ({
                    processId: process.id,
                    runTemplateId: r.runTemplateId,
                    displayName: r.displayName,
                    sortOrder: r.sortOrder,
                })),
            });

            this.logger.log(`[PROCESS][CREATED] processId=${process.id}`);
            return process;
        });
    }

    async getById(id: string) {
        const process = await this.prisma.process.findUnique({
            where: { id },
            include: { runDefs: true },
        });
        if (!process) throw new BadRequestException('Process not found');
        return process;
    }

    async getAll() {
        const processes = await this.prisma.process.findMany({
            include: { runDefs: true },
            orderBy: { name: 'asc' },
        });
        return processes.map(toProcessSummary);
    }

    async configureWithImages(
        orderProcessId: string,
        processRunId: string,
        dto: ConfigureProcessRunDto,
    ) {
        return this.prisma.transaction(async tx => {

            /* =====================================================
             * LOAD RUN + TEMPLATE
             * ===================================================== */
            const run = await tx.processRun.findFirst({
                where: { id: processRunId, orderProcessId },
                select: {
                    id: true,
                    statusCode: true,
                    fields: true,
                    orderProcessId: true,
                    orderProcess: {
                        select: { orderId: true },
                    },
                    runTemplate: {
                        select: {
                            fields: true,
                            configWorkflowType: {
                                select: {
                                    id: true,
                                    statuses: {
                                        select: { id: true, code: true, isInitial: true },
                                    },
                                    transitions: {
                                        select: { fromStatusId: true, toStatusId: true },
                                    },
                                },
                            },
                        },
                    },
                },
            });

            if (!run) {
                throw new BadRequestException('Invalid process run');
            }

            /* =====================================================
             * FIELD VALIDATION
             * ===================================================== */
            const normalizedFields = this.validateAndNormalizeFields(
                run.runTemplate.fields as RunTemplateField[],
                dto.fields,
            );
            /* =====================================================
            * EXECUTOR / REVIEWER VALIDATION
            * ===================================================== */
            if (dto.executorId || dto.reviewerId) {
                // Collect unique user IDs only
                const userIds = Array.from(
                    new Set(
                        [dto.executorId, dto.reviewerId].filter(Boolean),
                    ),
                ) as string[];

                const users = await tx.user.findMany({
                    where: {
                        id: { in: userIds },
                        deletedAt: null,
                        isActive: true,
                    },
                    select: { id: true },
                });

                if (users.length !== userIds.length) {
                    throw new BadRequestException(
                        'Invalid executor or reviewer',
                    );
                }
            }


            /* =====================================================
             * IMAGES (FROM DTO)
             * ===================================================== */
            const uploadedUrls: string[] = dto.images ?? [];

            if (uploadedUrls.length > 2) {
                throw new BadRequestException('Maximum 2 images allowed');
            }

            /* =====================================================
             * MERGE FIELDS
             * ===================================================== */
            const existingImages = (run.fields as any)?.images ?? [];

            const mergedFields = {
                ...(run.fields as Record<string, any> ?? {}),
                ...normalizedFields,
                images: [...existingImages, ...uploadedUrls].slice(0, 2),
            };

            /* =====================================================
             * WORKFLOW VALIDATION
             * ===================================================== */
            const wf = run.runTemplate.configWorkflowType;
            if (!wf) {
                throw new BadRequestException('Config workflow missing');
            }

            const current = wf.statuses.find(s => s.code === run.statusCode);
            if (!current || !current.isInitial) {
                throw new BadRequestException('Invalid config state');
            }

            const transition = wf.transitions.find(
                t => t.fromStatusId === current.id,
            );
            if (!transition) {
                throw new BadRequestException('No config transition');
            }

            const toStatus = wf.statuses.find(
                s => s.id === transition.toStatusId,
            );
            if (!toStatus) {
                throw new BadRequestException('Invalid transition target');
            }

            /* =====================================================
             * UPDATE RUN
             * ===================================================== */
            await tx.processRun.update({
                where: { id: run.id },
                data: {
                    fields: mergedFields,
                    statusCode: toStatus.code,

                    ...(dto.executorId !== undefined && {
                        executorId: dto.executorId,
                    }),

                    ...(dto.reviewerId !== undefined && {
                        reviewerId: dto.reviewerId,
                    }),
                },
            });

            /* =====================================================
             * ORDER PROCESS PROGRESS (UNCHANGED)
             * ===================================================== */
            const op = await tx.orderProcess.update({
                where: { id: run.orderProcessId },
                data: { configCompletedRuns: { increment: 1 } },
                select: {
                    id: true,
                    orderId: true,
                    totalRuns: true,
                    configCompletedRuns: true,
                    workflowTypeId: true,
                    statusCode: true,
                },
            });

            this.logger.log(
                `[CONFIG][ORDER_PROCESS_PROGRESS] orderProcess=${op.id} ${op.configCompletedRuns}/${op.totalRuns}`,
            );

            const finalized = await tx.orderProcess.updateMany({
                where: {
                    id: op.id,
                    configCompletedRuns: op.totalRuns,
                    configCompletedAt: null,
                },
                data: { configCompletedAt: new Date() },
            });

            if (finalized.count === 1) {
                this.logger.log(
                    `[CONFIG][ORDER_PROCESS_COMPLETED] orderProcess=${op.id}`,
                );

                await this.transitionOrderProcess(tx, op);

                const remaining = await tx.orderProcess.count({
                    where: {
                        orderId: op.orderId,
                        configCompletedAt: null,
                    },
                });

                if (remaining === 0) {
                    this.logger.log(
                        `[CONFIG][ALL_ORDER_PROCESSES_CONFIGURED] order=${op.orderId}`,
                    );
                    await this.orderService.transitionOrderById(
                        this.prisma.client,
                        op.orderId,
                    );
                }
            }

            return { success: true };
        });
    }


    async deleteRunImage(
        orderProcessId: string,
        processRunId: string,
        imageUrl: string,
    ) {
        const run = await this.prisma.processRun.findFirst({
            where: {
                id: processRunId,
                orderProcessId,
            },
            select: {
                id: true,
                fields: true,
            },
        });

        if (!run) {
            throw new NotFoundException('Process run not found');
        }

        const images = (run.fields as any)?.images ?? [];

        if (!images.includes(imageUrl)) {
            throw new BadRequestException(
                'Image not linked to this process run',
            );
        }

        // 1️⃣ Delete from Cloudflare R2
        await this.cloudflare.deleteFileByUrl(imageUrl);

        // 2️⃣ Remove from DB
        const updatedImages = images.filter(
            (url: string) => url !== imageUrl,
        );

        await this.prisma.processRun.update({
            where: { id: run.id },
            data: {
                fields: {
                    ...(run.fields as Record<string, any>),
                    images: updatedImages,
                },
            },
        });

        this.logger.log(
            `[RUN_IMAGE_DELETED] run=${run.id}`,
        );

        return {
            processRunId: run.id,
            deletedImage: imageUrl,
            remainingImages: updatedImages.length,
        };
    }


    async uploadRunImages(
        processRunId: string,
        files: Express.Multer.File[],
    ) {
        if (!files.length) {
            throw new BadRequestException('No images uploaded');
        }

        if (files.length > 2) {
            throw new BadRequestException('Maximum 2 images allowed');
        }

        const run = await this.prisma.processRun.findUnique({
            where: { id: processRunId },
            select: {
                id: true,
                fields: true,
                orderProcess: {
                    select: { orderId: true },
                },
            },
        });

        if (!run) {
            throw new NotFoundException('Process run not found');
        }

        const buffers = files.map(f => f.buffer);
        const filenames = files.map(f => f.originalname);

        this.logger.log(
            `[RUN_IMAGES][UPLOAD] run=${run.id} count=${files.length}`,
        );

        const urls = await this.cloudflare.uploadFiles(
            buffers,
            filenames,
            `orders/${run.orderProcess.orderId}/runs/${run.id}`,
        );

        const existingImages =
            (run.fields as any)?.images ?? [];

        const updatedFields = {
            ...(run.fields as Record<string, any>),
            images: [...existingImages, ...urls].slice(0, 2),
        };

        await this.prisma.processRun.update({
            where: { id: run.id },
            data: { fields: updatedFields },
        });

        return {
            processRunId: run.id,
            uploadedImages: urls,
            totalImages: updatedFields.images.length,
        };
    }

    /* =========================================================
     * ORDER PROCESS TRANSITION
     * ========================================================= */

    private async transitionOrderProcess(
        tx: Prisma.TransactionClient,
        op: {
            id: string;
            workflowTypeId: string;
            statusCode: string;
        },
    ) {
        const wf = await tx.workflowType.findUnique({
            where: { id: op.workflowTypeId },
            select: {
                id: true,
                statuses: { select: { id: true, code: true } },
                transitions: { select: { fromStatusId: true, toStatusId: true } },
            },
        });

        if (!wf) {
            throw new BadRequestException('OrderProcess workflow missing');
        }

        const current = wf.statuses.find(s => s.code === op.statusCode);
        if (!current) {
            throw new BadRequestException('Invalid OrderProcess status');
        }

        const transition = wf.transitions.find(
            t => t.fromStatusId === current.id,
        );
        if (!transition) {
            this.logger.log(
                `[ORDER_PROCESS][NO_TRANSITION] orderProcess=${op.id}`,
            );
            return;
        }

        const toStatus = wf.statuses.find(
            s => s.id === transition.toStatusId,
        );
        if (!toStatus) {
            throw new BadRequestException('Invalid OrderProcess transition target');
        }

        this.logger.log(
            `[ORDER_PROCESS][TRANSITION] orderProcess=${op.id} ${current.code} → ${toStatus.code}`,
        );

        await tx.orderProcess.updateMany({
            where: {
                id: op.id,
                statusCode: op.statusCode,
            },
            data: {
                statusCode: toStatus.code,
            },
        });
    }

    /* =========================================================
     * RUN LIFECYCLE TRANSITION
     * ========================================================= */

    async transition(orderProcessId: string, processRunId: string) {
        this.logger.log(
            `[LIFECYCLE][START] orderProcessId=${orderProcessId} processRunId=${processRunId}`,
        );

        return this.prisma.transaction(async tx => {
            const run = await tx.processRun.findFirst({
                where: { id: processRunId, orderProcessId },
                select: {
                    id: true,
                    orderProcessId: true,
                    lifeCycleStatusCode: true,
                    runTemplate: {
                        select: {
                            lifecycleWorkflowType: {
                                select: {
                                    id: true,
                                    statuses: {
                                        select: { id: true, code: true, isTerminal: true },
                                    },
                                    transitions: {
                                        select: { fromStatusId: true, toStatusId: true },
                                    },
                                },
                            },
                        },
                    },
                },
            });

            if (!run) {
                throw new BadRequestException('Invalid process run');
            }

            const wf = run.runTemplate.lifecycleWorkflowType;
            if (!wf) {
                throw new BadRequestException('Lifecycle workflow missing');
            }

            const current = wf.statuses.find(
                s => s.code === run.lifeCycleStatusCode,
            );
            if (!current) {
                throw new BadRequestException('Invalid lifecycle state');
            }

            const transition = wf.transitions.find(
                t => t.fromStatusId === current.id,
            );
            if (!transition) {
                throw new BadRequestException('No lifecycle transition');
            }

            const toStatus = wf.statuses.find(
                s => s.id === transition.toStatusId,
            );
            if (!toStatus) {
                throw new BadRequestException('Invalid lifecycle transition target');
            }

            this.logger.log(
                `[LIFECYCLE][RUN_TRANSITION] run=${run.id} ${current.code} → ${toStatus.code}`,
            );

            await tx.processRun.update({
                where: { id: run.id },
                data: { lifeCycleStatusCode: toStatus.code },
            });

            const orderProcess = await tx.orderProcess.findUnique({
                where: { id: run.orderProcessId },
                select: {
                    id: true,
                    orderId: true,
                    totalRuns: true,
                    lifecycleCompletedRuns: true,
                    workflowTypeId: true,
                    statusCode: true,
                },
            });

            if (!orderProcess) {
                throw new BadRequestException('Invalid order process');
            }

            const orderSnapshot = await tx.order.findUnique({
                where: { id: orderProcess.orderId },
                select: {
                    id: true,
                    lifecycleStartedAt: true,
                    statusCode: true,
                },
            });

            if (!orderSnapshot) {
                throw new BadRequestException('Invalid order');
            }

            /**
             * Start order lifecycle exactly once
             */

            let orderStatus: string = orderSnapshot.statusCode;

            if (!orderSnapshot.lifecycleStartedAt) {
                const started = await tx.order.updateMany({
                    where: {
                        id: orderSnapshot.id,
                        lifecycleStartedAt: null,
                    },
                    data: { lifecycleStartedAt: new Date() },
                });

                if (started.count === 1) {
                    this.logger.log(
                        `[ORDER][LIFECYCLE_STARTED] order=${orderSnapshot.id}`,
                    );

                    const orderForTransition = await tx.order.findUniqueOrThrow({
                        where: { id: orderSnapshot.id },
                        select: {
                            id: true,
                            workflowTypeId: true,
                            statusCode: true,
                        },
                    });

                    orderStatus = await this.orderService.transitionOrder(tx, orderForTransition);
                }
            }

            if (!toStatus.isTerminal) {
                return { success: true, status: orderStatus };
            }

            const updatedOrderProcess = await tx.orderProcess.update({
                where: { id: run.orderProcessId },
                data: { lifecycleCompletedRuns: { increment: 1 } },
                select: {
                    id: true,
                    orderId: true,
                    totalRuns: true,
                    lifecycleCompletedRuns: true,
                    workflowTypeId: true,
                    statusCode: true,
                },
            });

            const finalized = await tx.orderProcess.updateMany({
                where: {
                    id: updatedOrderProcess.id,
                    lifecycleCompletedRuns: updatedOrderProcess.totalRuns,
                    lifecycleCompletedAt: null,
                },
                data: { lifecycleCompletedAt: new Date() },
            });

            if (finalized.count === 1) {
                this.logger.log(
                    `[LIFECYCLE][ORDER_PROCESS_COMPLETED] orderProcess=${updatedOrderProcess.id}`,
                );

                await this.transitionOrderProcess(tx, updatedOrderProcess);

                const updatedOrder = await tx.order.update({
                    where: { id: updatedOrderProcess.orderId },
                    data: { completedProcesses: { increment: 1 } },
                    select: {
                        id: true,
                        workflowTypeId: true,
                        statusCode: true,
                        totalProcesses: true,
                        completedProcesses: true,
                    },
                });

                this.logger.log(
                    `[ORDER][PROGRESS] order=${updatedOrder.id} ${updatedOrder.completedProcesses}/${updatedOrder.totalProcesses}`,
                );

                if (
                    updatedOrder.completedProcesses ===
                    updatedOrder.totalProcesses
                ) {
                    orderStatus = await this.orderService.transitionOrder(tx, updatedOrder);
                }
            }

            return { success: true, status: orderStatus };
        });
    }



    /* =========================================================
     * FIELD VALIDATION
     * ========================================================= */

    private validateAndNormalizeFields(
        templateFields: RunTemplateField[],
        inputFields: Record<string, any>,
    ): Record<string, any> {
        const templateMap = new Map(
            templateFields.map(f => [f.key, f]),
        );

        const normalized: Record<string, any> = {};

        /* =====================================================
         * 1️⃣ Required field validation (template-owned)
         * ===================================================== */
        for (const field of templateFields) {
            if (field.required && !(field.key in inputFields)) {
                throw new BadRequestException(
                    `Missing field ${field.key}`,
                );
            }
        }

        /* =====================================================
         * 2️⃣ Input validation & normalization
         * ===================================================== */
        for (const [key, value] of Object.entries(inputFields)) {

            /* -----------------------------------------------
             * SYSTEM FIELDS (images, attachments, etc.)
             * ----------------------------------------------- */
            const systemValidator =
                AdminProcessService.SYSTEM_FIELD_VALIDATORS[key];
            if (systemValidator) {
                const normalizedValue = systemValidator(value);

                if (normalizedValue === null) {
                    throw new BadRequestException(
                        `Invalid value for system field ${key}`,
                    );
                }

                if (normalizedValue !== undefined) {
                    normalized[key] = normalizedValue;
                }

                continue;
            }


            /* -----------------------------------------------
             * TEMPLATE FIELDS
             * ----------------------------------------------- */
            const expected = templateMap.get(key);

            if (!expected) {
                throw new BadRequestException(
                    `Unknown field ${key}`,
                );
            }

            switch (expected.type) {
                case 'string':
                    if (typeof value !== 'string') {
                        throw new BadRequestException(
                            `Invalid type for ${key}, expected string`,
                        );
                    }
                    break;

                case 'number':
                    if (typeof value !== 'number') {
                        throw new BadRequestException(
                            `Invalid type for ${key}, expected number`,
                        );
                    }
                    break;

                default:
                    throw new BadRequestException(
                        `Unsupported field type ${expected.type} for ${key}`,
                    );
            }

            normalized[key] = value;
        }

        return normalized;
    }

}
