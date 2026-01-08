import {
    Injectable,
    Logger,
    BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { OutboxService } from '../outbox/outbox.service';
import { CreateRunDto } from './dto/create-run.dto';
import { ConfigureRunDto } from './dto/configure-run.dto';
import { RunFieldsValidator } from './run-fields.validator';

@Injectable()
export class RunsService {
    private readonly logger = new Logger(RunsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly outbox: OutboxService,
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
                include: { runTemplate: true },
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

    /* ---------------- CREATE RUN ---------------- */

    //async create(
    //    orderId: string,
    //    orderProcessId: string,
    //    dto: CreateRunDto,
    //) {
    //    await this.validateOrderProcess(
    //        orderId,
    //        orderProcessId,
    //    );

    //    const template =
    //        await this.prisma.runTemplate.findUnique({
    //            where: { id: dto.runTemplateId },
    //        });

    //    if (!template) {
    //        throw new BadRequestException(
    //            'Invalid run template',
    //        );
    //    }

    //    if (dto.fields) {
    //        this.fieldValidator.validate(
    //            template.fields as any[],
    //            dto.fields,
    //        );
    //    }

    //    const runNumber =
    //        (await this.prisma.processRun.count({
    //            where: { orderProcessId },
    //        })) + 1;

    //    const statusCode =
    //        await this.getInitialRunStatus();

    //    const run = await this.prisma.processRun.create({
    //        data: {
                
    //            orderProcessId,
    //            runTemplateId: template.id,
    //            runNumber,
    //            statusCode,
    //            fields: (dto.fields ?? {}) as Prisma.InputJsonValue,
    //        },
    //    });

    //    await this.outbox.add({
    //        aggregateType: 'RUN',
    //        aggregateId: run.id,
    //        eventType: 'RUN_CREATED',
    //        payload: {
    //            orderId,
    //            orderProcessId,
    //            runTemplateId: template.id,
    //        },
    //    });

    //    this.logger.log(`Run created: ${run.id}`);
    //    return run;
    //}

    /* ---------------- CONFIGURE RUN ---------------- */

    async configure(
        orderId: string,
        orderProcessId: string,
        runId: string,
        dto: ConfigureRunDto,
    ) {
        const run = await this.validateRun(
            orderId,
            orderProcessId,
            runId,
        );

        this.fieldValidator.validate(
            run.runTemplate.fields as any[],
            dto.fields,
        );

        await this.prisma.processRun.update({
            where: { id: runId },
            data: {
                fields: dto.fields as Prisma.InputJsonValue,
            },
        });

        await this.outbox.add({
            aggregateType: 'RUN',
            aggregateId: runId,
            eventType: 'RUN_CONFIGURED',
            payload: dto,
        });

        return { status: 'CONFIGURED' };
    }

    /* ---------------- LOCATION ---------------- */

    async updateLocation(
        orderId: string,
        orderProcessId: string,
        runId: string,
        location: string,
    ) {
        await this.validateRun(
            orderId,
            orderProcessId,
            runId,
        );

        await this.prisma.processRun.update({
            where: { id: runId },
            data: { location },
        });

        await this.outbox.add({
            aggregateType: 'RUN',
            aggregateId: runId,
            eventType: 'RUN_LOCATION_UPDATED',
            payload: { location },
        });

        return { status: 'LOCATION_UPDATED' };
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
            include: { runTemplate: true },
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
