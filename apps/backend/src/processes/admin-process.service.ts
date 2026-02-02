import {
    ConfigureProcessRunDto,
    CreateProcessDto,
    LifeCycleStatusDto,
    ProcessRunListItemDto,
    RunTemplateField
} from '@app/contracts';
import {
    BadRequestException,
    Injectable,
    NotFoundException
} from '@nestjs/common';
import { OrderStatus, Prisma, ProcessRunStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CloudflareService } from '../common/cloudflare.service';
import { ContextLogger } from '../common/logger/context.logger';
import { ProcessRunsQueryDto } from '../dto/process-runs.query.dto';
import { toProcessSummary } from '../mappers/process.mapper';
import { OrdersService } from '../orders/orders.service';

@Injectable()
export class AdminProcessService {
    private readonly logger = new ContextLogger(AdminProcessService.name);
    private static readonly SYSTEM_FIELDS = new Set<string>([
        'images',
    ]);


    async getLifeCycleStatusesByProcess(processId: string): Promise<LifeCycleStatusDto[]> {
        // 1️⃣ Get all lifecycle workflow type IDs used by this process
        const runDefs = await this.prisma.processRunDefinition.findMany({
            where: { processId },
            select: {
                runTemplate: {
                    select: {
                        lifecycleWorkflowTypeId: true,
                    },
                },
            },
        });

        const workflowTypeIds = [
            ...new Set(
                runDefs.map(
                    (d) => d.runTemplate.lifecycleWorkflowTypeId,
                ),
            ),
        ];

        if (workflowTypeIds.length === 0) {
            return [];
        }

        // 2️⃣ Fetch lifecycle statuses
        const statuses = await this.prisma.workflowStatus.findMany({
            where: {
                workflowTypeId: { in: workflowTypeIds },
            },
            select: {
                id: true,
                code: true,
            },
        });

        return statuses;
    }

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
            where: { id, isEnabled: true },
            include: { runDefs: true },
        });
        if (!process) throw new BadRequestException('Process not found');
        return process;
    }

    async getAll() {
        const processes = await this.prisma.process.findMany({
            include: { runDefs: true },
            where: { isEnabled: true },
            orderBy: { name: 'asc' },
        });
        return processes.map(toProcessSummary);
    }

    private priorityWhere(priorities: string | string[]): Prisma.OrderProcessWhereInput {
        // Normalize to array
        const priorityList = (typeof priorities === 'string' ? priorities.split(',') : priorities) as Array<'HIGH' | 'MEDIUM' | 'LOW'>;

        if (priorityList.length === 0) return {};

        const conditions: Prisma.OrderProcessWhereInput[] = [];

        if (priorityList.includes('HIGH')) {
            conditions.push({ remainingRuns: { lt: 5 } });
        }

        if (priorityList.includes('MEDIUM')) {
            conditions.push({ remainingRuns: { gte: 5, lt: 10 } });
        }

        if (priorityList.includes('LOW')) {
            conditions.push({ remainingRuns: { gte: 10 } });
        }

        if (conditions.length === 1) {
            return conditions[0];
        }

        return { OR: conditions };
    }


    async getAllRuns(query: ProcessRunsQueryDto) {
        const {
            page = 1,
            limit = 20,
            search,
            status,
            customerId,
            executorUserId,
            reviewerUserId,
            lifeCycleStatusCode,
            priority,
            createdFrom,
            createdTo,
            processId,
        } = query;

        const skip = (page - 1) * limit;

        /* ==========================
         * ORDER WHERE
         * ========================== */
        const orderWhere: Prisma.OrderWhereInput = {
            ...(customerId && { customerId }),
        };

        /* ==========================
         * ORDER PROCESS WHERE
         * ========================== */
        // Note: priority filter here uses the "absolute remaining" logic from priorityWhere, 
        // while the sort uses "percentage" logic from resolvePriority.
        const orderProcessWhere: Prisma.OrderProcessWhereInput = {
            ...(processId && { processId }),
            ...(priority && this.priorityWhere(priority)),
            ...(Object.keys(orderWhere).length > 0 && {
                order: orderWhere,
            }),
        };

        /* ==========================
         * PROCESS RUN WHERE
         * ========================== */
        const where: Prisma.ProcessRunWhereInput = {
            ...(status && {
                statusCode: { in: status.split(',') as ProcessRunStatus[] },
            }),

            ...(executorUserId && { executorId: executorUserId }),
            ...(reviewerUserId && { reviewerId: reviewerUserId }),
            ...(lifeCycleStatusCode ? {
                lifeCycleStatusCode: { in: lifeCycleStatusCode.split(',') }
            } : (
                !status ? {
                    lifeCycleStatusCode: { notIn: ['COMPLETE', 'BILLED'] }
                } : {}
            )),

            ...(createdFrom || createdTo
                ? {
                    createdAt: {
                        ...(createdFrom && { gte: new Date(createdFrom) }),
                        ...(createdTo && { lte: new Date(createdTo) }),
                    },
                }
                : {}),

            ...(search && {
                OR: [
                    {
                        orderProcess: {
                            order: {
                                code: { contains: search, mode: 'insensitive' },
                            },
                        },
                    },
                    {
                        orderProcess: {
                            order: {
                                customer: {
                                    name: { contains: search, mode: 'insensitive' },
                                },
                            },
                        },
                    },
                    {
                        runTemplate: {
                            name: { contains: search, mode: 'insensitive' },
                        },
                    },
                ],
            }),

            // Filter by assigned user (executor OR reviewer)
            ...(query.assignedUserId && {
                OR: [
                    { executorId: query.assignedUserId },
                    { reviewerId: query.assignedUserId },
                ],
            }),

            ...(Object.keys(orderProcessWhere).length > 0 && {
                orderProcess: orderProcessWhere,
            }),
        };

        /* ==========================
         * 1. FETCH METADATA FOR SORTING
         * ========================== */
        const total = await this.prisma.processRun.count({ where });

        // If we are just filtering/searching and relying on default sort (createdAt) 
        // we could optimize, but user requested PRIORITY sort specifically as primary.
        // We fetch minimal data to sort in memory.
        const allCandidates = await this.prisma.processRun.findMany({
            where,
            select: {
                id: true,
                statusCode: true,
                createdAt: true,
                fields: true, // Fetch fields for aggregation
                orderProcess: {
                    select: {
                        lifecycleCompletedRuns: true,
                        totalRuns: true,
                    },
                },
            },
        });

        /* ==========================
         * 2. IN-MEMORY SORT
         * ========================== */
        const getPriorityRank = (completed: number, total: number, status: string) => {
            if (status === 'CONFIGURE') return 2; // LOW
            if (total === 0) return 2; // LOW
            const ratio = 1 - (completed / total);
            if (ratio < 0.3 || total - completed < 2) return 0; // HIGH
            if (ratio < 0.75) return 1; // MEDIUM
            return 2; // LOW
        };

        allCandidates.sort((a, b) => {
            const rankA = getPriorityRank(a.orderProcess.lifecycleCompletedRuns, a.orderProcess.totalRuns, a.statusCode);
            const rankB = getPriorityRank(b.orderProcess.lifecycleCompletedRuns, b.orderProcess.totalRuns, b.statusCode);

            if (rankA !== rankB) {
                return rankA - rankB; // 0 (HIGH) -> 1 (MED) -> 2 (LOW)
            }

            // Tie-breaker: CreatedAt Descending (Newest first)
            return b.createdAt.getTime() - a.createdAt.getTime();
        });

        /* ==========================
         * 3. PAGINATE & FETCH FULL DATA
         * ========================== */
        const slicedCandidates = allCandidates.slice(skip, skip + limit);
        const slicedIds = slicedCandidates.map(c => c.id);

        let runs: any[] = [];
        if (slicedIds.length > 0) {
            const unsortedRuns = await this.prisma.processRun.findMany({
                where: { id: { in: slicedIds } },
                select: {
                    id: true,
                    runNumber: true,
                    statusCode: true,
                    lifeCycleStatusCode: true,
                    fields: true,
                    createdAt: true,
                    runTemplate: {
                        select: { name: true },
                    },
                    executor: {
                        select: { name: true },
                    },
                    reviewer: {
                        select: { name: true },
                    },
                    orderProcess: {
                        select: {
                            totalRuns: true,
                            lifecycleCompletedRuns: true,
                            remainingRuns: true,
                            order: {
                                select: {
                                    id: true,
                                    code: true,
                                    customer: { select: { name: true } },
                                },
                            },
                        },
                    },
                },
            });

            // Re-sort to match the slicedCandidates order
            const runMap = new Map(unsortedRuns.map(r => [r.id, r]));
            runs = slicedIds.map(id => runMap.get(id)).filter(Boolean);
        }

        /* ==========================
         * MAP → DTO
         * ========================== */
        const data: ProcessRunListItemDto[] = runs.map((run) => {
            // Pick only used fields
            let relevantFields: Record<string, any> = {};
            if (run.fields) {
                const f = run.fields as any;
                if (f.images) relevantFields['images'] = f.images;
                if (f['Quantity']) relevantFields['Quantity'] = f['Quantity'];
                if (f['Estimated Amount']) relevantFields['Estimated Amount'] = f['Estimated Amount'];
            }

            return {
                ...run,
                fields: relevantFields,
                // Exclude createdAt and orderProcess stats from payload
                // but keep structure required by DTO (which is now optional)
                orderProcess: {
                    order: run.orderProcess.order,
                },
                createdAt: undefined, // remove from JSON
                priority: this.resolvePriority(
                    run.orderProcess.remainingRuns,
                    run.orderProcess.lifecycleCompletedRuns,
                    run.orderProcess.totalRuns,
                    run.statusCode
                ),
            };
        });

        return {
            data,
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                totalEstimatedAmount: allCandidates.reduce((sum, run) => {
                    const amt = (run.fields as any)?.['Estimated Amount'];
                    if (amt === undefined || amt === null) return sum;
                    const cleanAmt = String(amt).replace(/[^0-9.-]+/g, '');
                    const val = parseFloat(cleanAmt);
                    return sum + (isNaN(val) ? 0 : val);
                }, 0),
            },
        };
    }

    private resolvePriority(remainingRuns: number, completedRuns: number, totalRuns: number, statusCode?: string): 'HIGH' | 'MEDIUM' | 'LOW' {
        if (statusCode === 'CONFIGURE') return 'LOW';
        if (totalRuns === 0) return 'LOW';
        if (1 - (completedRuns / totalRuns) < 0.3 || totalRuns - completedRuns < 2) return 'HIGH';
        if (1 - (completedRuns / totalRuns) < 0.75) return 'MEDIUM';
        return 'LOW';
    }

    private isJsonObject(
        value: Prisma.JsonValue,
    ): value is Prisma.JsonObject {
        return typeof value === 'object' && value !== null && !Array.isArray(value);
    }

    private extractImages(
        fields: Prisma.JsonValue,
    ): string[] {
        if (!this.isJsonObject(fields)) return [];

        const images = fields['images'];
        return Array.isArray(images)
            ? images.filter((v): v is string => typeof v === 'string')
            : [];
    }

    async configure(
        orderProcessId: string,
        processRunId: string,
        dto: ConfigureProcessRunDto,
    ) {
        return this.prisma.transaction(async tx => {

            /* =====================================================
             * LOAD RUN + TEMPLATE (UNCHANGED)
             * ===================================================== */
            const run = await tx.processRun.findFirst({
                where: { id: processRunId, orderProcessId },
                select: {
                    id: true,
                    fields: true,
                    configuredAt: true,            // ⭐ added
                    statusCode: true,              // ⭐ added
                    orderProcessId: true,
                    runTemplate: {
                        select: { fields: true },
                    },
                },
            });

            if (!run) {
                throw new BadRequestException('Invalid process run');
            }
            /* =====================================================
             * FIELD VALIDATION (UNCHANGED)
             * ===================================================== */
            const normalizedFields = this.validateAndNormalizeFields(
                run.runTemplate.fields as RunTemplateField[],
                dto.fields,
            );

            /* =====================================================
             * EXECUTOR / REVIEWER VALIDATION (UNCHANGED)
             * ===================================================== */
            if (dto.executorId || dto.reviewerId) {
                const userIds = Array.from(
                    new Set([dto.executorId, dto.reviewerId].filter(Boolean)),
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
                    throw new BadRequestException('Invalid executor or reviewer');
                }
            }

            /* =====================================================
             * IMAGES (PRESERVE OLD LOGIC + ADD RECONFIG)
             * ===================================================== */
            const uploadedUrls = dto.images ?? [];

            if (uploadedUrls.length > 2) {
                throw new BadRequestException('Maximum 2 images allowed');
            }

            if (uploadedUrls.some(url => !this.cloudflare.isValidImageUrl(url))) {
                throw new BadRequestException('Invalid image URLs provided');
            }

            const existingImages = this.isJsonObject(run.fields)
                ? this.getStringArray(run.fields['images'])
                : [];


            // ⭐ replace only if new images provided
            const finalImages =
                uploadedUrls.length > 0 ? uploadedUrls : existingImages;

            /* =====================================================
             * MERGE FIELDS (SAME SHAPE AS OLD)
             * ===================================================== */
            const mergedFields: Prisma.JsonObject = {
                ...(this.isJsonObject(run.fields) ? run.fields : {}),
                ...normalizedFields,
                images: finalImages,
            };

            /* =====================================================
             * UPDATE RUN (SPLIT FIRST-TIME VS RECONFIG)
             * ===================================================== */
            await tx.processRun.update({
                where: { id: run.id },
                data: {
                    fields: mergedFields,
                    ...(dto.executorId !== undefined && { executorId: dto.executorId }),
                    ...(dto.reviewerId !== undefined && { reviewerId: dto.reviewerId }),
                    ...(run.configuredAt
                        ? {}
                        : {
                            configuredAt: new Date(),           // ⭐ first time only
                            statusCode: ProcessRunStatus.IN_PROGRESS,
                        }),
                },
            });

            /* =====================================================
             * PROCESS COUNTERS (FIRST TIME ONLY)
             * ===================================================== */
            if (!run.configuredAt) {
                await tx.orderProcess.update({
                    where: { id: run.orderProcessId },
                    data: {
                        configCompletedRuns: { increment: 1 },
                        remainingRuns: { decrement: 1 },
                    },
                });
            }

            /* =====================================================
             * IMAGE CLEANUP (ONLY IF REPLACED)
             * ===================================================== */
            if (uploadedUrls.length > 0 && existingImages.length > 0) {
                const toDelete = existingImages.filter(
                    img => !uploadedUrls.includes(img),
                );

                if (toDelete.length) {
                    await this.cloudflare.deleteFiles(toDelete);
                }
            }

            return { success: true };
        });
    }


    private getStringArray(value: unknown): string[] {
        return Array.isArray(value)
            ? value.filter((v): v is string => typeof v === 'string')
            : [];
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
     * RUN DETAIL
     * ========================================================= */

    async getRunById(id: string): Promise<any> { // Typing as any to bypass circular dep issues internally, mapped to DTO in controller
        const run = await this.prisma.processRun.findUnique({
            where: { id },
            include: {
                runTemplate: {
                    include: {
                        lifecycleWorkflowType: {
                            include: {
                                statuses: {
                                    orderBy: { createdAt: 'asc' },
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
                executor: {
                    select: { id: true, name: true },
                },
                reviewer: {
                    select: { id: true, name: true },
                },
                orderProcess: {
                    include: {
                        order: {
                            select: {
                                id: true,
                                code: true,
                                customer: { select: { name: true } },
                            },
                        },
                    },
                },
            },
        });

        if (!run) throw new NotFoundException('Process run not found');

        return {
            ...run,
            createdAt: run.createdAt.toISOString(),
            priority: this.resolvePriority(
                run.orderProcess.remainingRuns,
                run.orderProcess.lifecycleCompletedRuns,
                run.orderProcess.totalRuns,
                run.statusCode
            ),
            displayName: run.displayName,
            configStatus: run.statusCode,
            lifecycle: this.buildLifecycleProgress(
                run.runTemplate.lifecycleWorkflowType.statuses,
                run.lifeCycleStatusCode,
            ),
            fields: run.fields as Record<string, any> || {},
            templateFields: run.runTemplate.fields as any[], // Typing bypass
            // Ensure orderProcess matches DTO
            orderProcess: {
                totalRuns: run.orderProcess.totalRuns,
                lifecycleCompletedRuns: run.orderProcess.lifecycleCompletedRuns,
                remainingRuns: run.orderProcess.remainingRuns,
                order: run.orderProcess.order,
            },
        };
    }

    private buildLifecycleProgress(
        statuses: { code: string; isTerminal: boolean }[],
        currentCode: string,
    ) {
        let reachedCurrent = false;

        return statuses.map(s => {
            if (s.code === currentCode) {
                reachedCurrent = true;
                return {
                    code: s.code,
                    completed: s.isTerminal,
                };
            }

            return {
                code: s.code,
                completed: !reachedCurrent,
            };
        });
    }

    /* =========================================================
     * RUN LIFECYCLE TRANSITION
     * ========================================================= */

    async transition(
        orderProcessId: string,
        processRunId: string,
        targetStatusCode: string,
    ) {
        this.logger.log(
            `[LIFECYCLE][START] orderProcess=${orderProcessId} run=${processRunId} → ${targetStatusCode}`,
        );

        return this.prisma.transaction(async tx => {

            /* =====================================================
             * 1️⃣ LOAD RUN (MINIMAL)
             * ===================================================== */
            const run = await tx.processRun.findFirst({
                where: { id: processRunId, orderProcessId },
                select: {
                    id: true,
                    orderProcessId: true,
                    lifeCycleStatusCode: true,
                    runTemplateId: true,
                },
            });

            if (!run) {
                throw new BadRequestException('Invalid process run');
            }

            /* =====================================================
             * 2️⃣ LOAD WORKFLOW ID
             * ===================================================== */
            const template = await tx.runTemplate.findUnique({
                where: { id: run.runTemplateId },
                select: { lifecycleWorkflowTypeId: true },
            });

            if (!template) {
                throw new BadRequestException('RunTemplate missing');
            }

            /* =====================================================
             * 3️⃣ LOAD BOTH CURRENT + TARGET STATUSES
             * ===================================================== */
            const statuses = await tx.workflowStatus.findMany({
                where: {
                    workflowTypeId: template.lifecycleWorkflowTypeId,
                    code: {
                        in: [
                            run.lifeCycleStatusCode,
                            targetStatusCode,
                        ],
                    },
                },
                select: {
                    id: true,
                    code: true,
                    isTerminal: true,
                },
            });

            const current = statuses.find(
                s => s.code === run.lifeCycleStatusCode,
            );

            if (!current) {
                throw new BadRequestException('Invalid current lifecycle state');
            }

            if (current.isTerminal) {
                throw new BadRequestException('Run already in terminal state');
            }

            const target = statuses.find(
                s => s.code === targetStatusCode,
            );

            if (!target) {
                throw new BadRequestException('Invalid target lifecycle state');
            }

            /* =====================================================
             * 4️⃣ UPDATE RUN STATUS
             * ===================================================== */
            await tx.processRun.update({
                where: { id: run.id },
                data: { lifeCycleStatusCode: target.code },
            });

            /* =====================================================
             * 5️⃣ EARLY EXIT IF NOT TERMINAL
             * ===================================================== */
            if (!target.isTerminal) {
                return { success: true, status: target.code };
            }

            /* =====================================================
             * 6️⃣ TERMINAL HANDLING
             * ===================================================== */
            const updatedOrderProcess = await tx.orderProcess.update({
                where: { id: run.orderProcessId },
                data: { lifecycleCompletedRuns: { increment: 1 } },
                select: {
                    id: true,
                    orderId: true,
                    totalRuns: true,
                    lifecycleCompletedRuns: true,
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
                const updatedOrder = await tx.order.update({
                    where: { id: updatedOrderProcess.orderId },
                    data: { completedProcesses: { increment: 1 } },
                    select: {
                        id: true,
                        totalProcesses: true,
                        completedProcesses: true,
                    },
                });

                if (updatedOrder.completedProcesses === updatedOrder.totalProcesses) {
                    await tx.order.update({
                        where: { id: updatedOrder.id },
                        data: { statusCode: OrderStatus.COMPLETE },
                    });
                }
            }

            return { success: true, status: target.code };
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
