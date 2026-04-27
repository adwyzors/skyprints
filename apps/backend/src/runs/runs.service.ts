import {
    BadRequestException,
    Injectable
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ContextLogger } from '../common/logger/context.logger';
import { RunFieldsValidator } from './run-fields.validator';

const POST_PROD_STAGES = [
    'WAITING',
    'CUTTING/WEEDING',
    'CURING',
    'FUSING',
    'QC & COUNTING',
    'COMPLETE',
    'BILLED',
];

/**
 * Determines the effective location for a run based on its lifecycle status.
 * Post-production stages use postProductionLocationId, others use preProductionLocationId.
 * Falls back to locationId if the specific field is null (backward compatibility).
 */
export function getEffectiveLocationId(run: {
    lifeCycleStatusCode?: string;
    postProductionLocationId?: string | null;
    preProductionLocationId?: string | null;
    locationId?: string | null;
}): string | null {
    const status = run.lifeCycleStatusCode;

    if (status && POST_PROD_STAGES.includes(status)) {
        return run.postProductionLocationId ?? run.locationId ?? null;
    }

    return run.preProductionLocationId ?? run.locationId ?? null;
}

@Injectable()
export class RunsService {
    private readonly logger = new ContextLogger(RunsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly fieldValidator: RunFieldsValidator,
    ) { }

    /* ---------------- HELPERS ---------------- */

    private async validateOrderProcess(
        orderId: string,
        orderProcessId: string,
    ) {
        const orderProcess =
            await this.prisma.orderProcess.findFirst({
                where: {
                    id: orderProcessId,
                    orderId,
                },
            });

        if (!orderProcess) {
            throw new BadRequestException(
                'Invalid order / process combination',
            );
        }

        return orderProcess;
    }

    private async validateRun(
        orderId: string,
        orderProcessId: string,
        runId: string,
    ) {
        const run =
            await this.prisma.processRun.findFirst({
                where: {
                    id: runId,
                    orderProcessId,
                    orderProcess: { orderId },
                },
                include: {
                    runTemplate: true,
                    location: true,
                },
            });

        if (!run) {
            throw new BadRequestException(
                'Run not found for given order/process',
            );
        }

        return run;
    }

    private async getInitialRunStatus(): Promise<string> {
        const status =
            await this.prisma.workflowStatus.findFirst({
                where: {
                    workflowType: { code: 'RUN' },
                    isInitial: true,
                },
            });

        if (!status) {
            throw new BadRequestException(
                'Initial RUN status not configured',
            );
        }

        return status.code;
    }

    /* ---------------- QUERIES ---------------- */

    async list(
        orderId: string,
        orderProcessId: string,
    ) {
        await this.validateOrderProcess(
            orderId,
            orderProcessId,
        );

        return this.prisma.processRun.findMany({
            where: { orderProcessId },
            include: {
                runTemplate: true,
                location: true,
            },
            orderBy: { runNumber: 'asc' },
        });
    }

    async get(
        orderId: string,
        orderProcessId: string,
        runId: string,
    ) {
        return this.validateRun(
            orderId,
            orderProcessId,
            runId,
        );
    }
}
