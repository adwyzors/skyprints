import { CreateRunTemplateDto } from '@app/contracts';
import {
    BadRequestException,
    Injectable
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ContextLogger } from '../common/logger/context.logger';
import { validateBillingFormula } from './formula/formula-validator';
import { attachFormulaKeys } from './utils/field-normalizer';

@Injectable()
export class RunTemplatesService {
    private readonly logger = new ContextLogger(RunTemplatesService.name);

    constructor(private readonly prisma: PrismaService) { }

    async create(dto: CreateRunTemplateDto) {
        return this.prisma.transaction(async (tx) => {
            this.logger.log(`Creating RunTemplate ${dto.name}`);

            // 1. Attach formulaKey, keep UI key unchanged
            const enrichedFields = attachFormulaKeys(dto.fields);

            // 2. Validate formula using formulaKey
            validateBillingFormula(dto.billingFormula, enrichedFields);

            const configWF = await this.createWorkflow(
                tx,
                `RUN_TEMPLATE_${dto.name}_CONFIG`,
                ['CONFIGURE', 'COMPLETE'],
            );

            const lifecycleWF = await this.createWorkflow(
                tx,
                `RUN_TEMPLATE_${dto.name}_LIFECYCLE`,
                dto.lifecycle,
            );

            return tx.runTemplate.create({
                data: {
                    name: dto.name,
                    fields: enrichedFields, // ✅ UI key preserved
                    billingFormula: dto.billingFormula, // uses formulaKey
                    configWorkflowTypeId: configWF.id,
                    lifecycleWorkflowTypeId: lifecycleWF.id,
                },
            });
        });
    }

    async list() {
        return this.prisma.runTemplate.findMany({
            select: {
                id: true,
                name: true,
            },
        });
    }

    async get(id: string) {
        const template = await this.prisma.runTemplate.findUnique({
            where: { id },
            include: {
                configWorkflowType: {
                    include: {
                        statuses: {
                            orderBy: { createdAt: 'asc' },
                            select: { code: true },
                        },
                    },
                },
                lifecycleWorkflowType: {
                    include: {
                        statuses: {
                            orderBy: { createdAt: 'asc' },
                            select: { code: true },
                        },
                    },
                },
            },
        });

        if (!template) {
            throw new BadRequestException('RunTemplate not found');
        }

        return template;
    }

    private async createWorkflow(
        tx: Prisma.TransactionClient,
        code: string,
        states: string[],
    ) {
        // 1️⃣ Idempotent workflow
        const wf = await tx.workflowType.upsert({
            where: { code },
            update: {},
            create: { code },
        });

        // 2️⃣ Idempotent statuses
        await tx.workflowStatus.createMany({
            data: states.map((s, i) => ({
                workflowTypeId: wf.id,
                code: s,
                isInitial: i === 0,
                isTerminal: i === states.length - 1,
            })),
            skipDuplicates: true,
        });

        const statuses = await tx.workflowStatus.findMany({
            where: { workflowTypeId: wf.id },
            orderBy: { createdAt: 'asc' },
        });

        // 3️⃣ Idempotent transitions
        await tx.workflowTransition.createMany({
            data: statuses.slice(0, -1).map((s, i) => ({
                workflowTypeId: wf.id,
                fromStatusId: s.id,
                toStatusId: statuses[i + 1].id,
            })),
            skipDuplicates: true,
        });

        return wf;
    }
}
