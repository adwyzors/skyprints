import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class WorkflowRepository {
    constructor(private readonly prisma: PrismaService) { }

    async findWorkflowTypeByCode(code: string) {
        return this.prisma.workflowType.findUnique({
            where: { code },
        });
    }

    async findTransitionByCodes(params: {
        workflowTypeId: string;
        fromStatusCode: string;
        toStatusCode: string;
    }) {
        return this.prisma.workflowTransition.findFirst({
            where: {
                workflowTypeId: params.workflowTypeId,
                fromStatus: {
                    code: params.fromStatusCode,
                },
                toStatus: {
                    code: params.toStatusCode,
                },
            },
            include: {
                fromStatus: true,
                toStatus: true,
            },
        });
    }
}
