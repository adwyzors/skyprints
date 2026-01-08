import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class OutboxHandlers {
    private readonly logger = new Logger(OutboxHandlers.name);

    constructor(private readonly prisma: PrismaService) { }

    async handle(event: {
        eventType: string;
        aggregateId: string;
        payload: any;
    }) {
        switch (event.eventType) {
            case 'ORDER_CREATED':
                return this.handleOrderCreated(event);

            case 'STATUS_TRANSITION_REQUESTED':
                return this.handleStatusTransition(event);

            default:
                this.logger.warn(
                    `Unhandled outbox event: ${event.eventType}`,
                );
        }
    }


    private async handleOrderCreated(event: {
        aggregateId: string;
        payload: {
            orderId: string;
            processIds: string[];
        };
    }) {
        const { orderId, processIds } = event.payload;

        const [processStatus, runStatus] =
            await Promise.all([
                this.prisma.workflowStatus.findFirstOrThrow({
                    where: {
                        workflowType: { code: 'PROCESS' },
                        isInitial: true,
                    },
                }),
                this.prisma.workflowStatus.findFirstOrThrow({
                    where: {
                        workflowType: { code: 'RUN' },
                        isInitial: true,
                    },
                }),
            ]);

        const processes = await this.prisma.process.findMany({
            where: { id: { in: processIds } },
            include: { runDefs: true },
        });

        for (const process of processes) {
            const op = await this.prisma.orderProcess.create({
                data: {
                    orderId,
                    processId: process.id,
                    statusCode: processStatus.code,
                },
            });

            let runNo = 1;
            for (const def of process.runDefs) {
                await this.prisma.processRun.create({
                    data: {
                        displayName: def.displayName,
                        orderProcessId: op.id,
                        runTemplateId: def.runTemplateId,
                        runNumber: runNo++,
                        statusCode: runStatus.code,
                        fields: {}, //TODO: get fields from runTemplate table 
                    },
                });
            }
        }

        this.logger.log(
            `ORDER_CREATED processed | order=${orderId}`,
        );
    }

    /**
     * IDEMPOTENT:
     * - Check current status
     * - Apply only if not already applied
     */
    private async handleStatusTransition(event: {
        aggregateId: string;
        payload: {
            toStatusCode: string;
        };
    }) {
        const { aggregateId, payload } = event;

        const run = await this.prisma.processRun.findUnique({
            where: { id: aggregateId },
        });

        if (!run) {
            this.logger.warn(`Run not found: ${aggregateId}`);
            return;
        }

        if (run.statusCode === payload.toStatusCode) {
            this.logger.debug(
                `Idempotent skip | run=${aggregateId}`,
            );
            return;
        }

        await this.prisma.processRun.update({
            where: { id: aggregateId },
            data: { statusCode: payload.toStatusCode },
        });

        this.logger.log(
            `Status updated | run=${aggregateId} → ${payload.toStatusCode}`,
        );
    }
}
