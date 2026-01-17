import { CreateRunTemplateDto } from '@app/contracts';
import {
    BadRequestException,
    Injectable,
    Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { validateBillingFormula } from './formula/formula-validator';
import { attachFormulaKeys } from './utils/field-normalizer';

@Injectable()
export class RunTemplatesService {
    private readonly logger = new Logger(RunTemplatesService.name);

    constructor(private readonly prisma: PrismaService) { }

    async create(dto: CreateRunTemplateDto) {
        return this.prisma.$transaction(async (tx) => {
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

    private async createWorkflow(tx, code: string, states: string[]) {
        const wf = await tx.workflowType.create({ data: { code } });

        const statuses = await Promise.all(
            states.map((s, i) =>
                tx.workflowStatus.create({
                    data: {
                        workflowTypeId: wf.id,
                        code: s,
                        isInitial: i === 0,
                        isTerminal: i === states.length - 1,
                    },
                }),
            ),
        );

        for (let i = 0; i < statuses.length - 1; i++) {
            await tx.workflowTransition.create({
                data: {
                    workflowTypeId: wf.id,
                    fromStatusId: statuses[i].id,
                    toStatusId: statuses[i + 1].id,
                },
            });
        }

        return wf;
    }
}
