import {
    BadRequestException,
    Injectable,
    Logger,
    NotFoundException
} from "@nestjs/common";
import { PrismaService } from "apps/backend/prisma/prisma.service";
import { FormulaCompiler } from "./formula/formula-compiler";
import { MathOnlyFormulaEngine } from "./formula/math-only.formula.engine";
import { extractNumericVariables } from "./utils/field-mapper";
import { extractFormulaVariables } from "./utils/formula-variable-extractor";

@Injectable()
export class BillingService {
    private readonly logger = new Logger(BillingService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly engine: MathOnlyFormulaEngine,
        private readonly compiler: FormulaCompiler
    ) { }

    private validateDynamicInputs(
        inputs: Record<string, number>
    ) {
        const variableRegex = /^[a-z][a-z0-9_]*$/;

        for (const [key, value] of Object.entries(inputs)) {
            if (!variableRegex.test(key)) {
                throw new BadRequestException(
                    `Invalid variable name: ${key}`
                );
            }

            if (typeof value !== "number" || !Number.isFinite(value)) {
                throw new BadRequestException(
                    `Invalid numeric value for ${key}`
                );
            }
        }
    }

    async calculateWithDynamicInputs(
        orderProcessId: string,
        processRunId: string,
        dynamicInputs: Record<string, number> = {}
    ): Promise<number> {
        this.logger.log(
            `Billing calc start orderProcess=${orderProcessId}, run=${processRunId}`
        );

        this.validateDynamicInputs(dynamicInputs);

        const run = await this.prisma.processRun.findFirst({
            where: {
                id: processRunId,
                orderProcessId
            },
            include: {
                runTemplate: true
            }
        });

        if (!run) {
            throw new NotFoundException("ProcessRun not found");
        }

        const formula = run.runTemplate.billingFormula;
        if (!formula) {
            throw new BadRequestException(
                "Billing formula not configured"
            );
        }

        // 🔹 Static variables (from ProcessRun.fields)
        const staticVars = extractNumericVariables(
            run.fields as Record<string, unknown>
        );

        // 🔹 Variables required by formula
        const requiredVars = extractFormulaVariables(formula);

        // 🔹 Check missing variables
        for (const variable of requiredVars) {
            if (
                !(variable in staticVars) &&
                !(variable in dynamicInputs)
            ) {
                throw new BadRequestException(
                    `Missing required variable: ${variable}`
                );
            }
        }

        // 🔹 Merge static + dynamic
        const mergedVariables = {
            ...staticVars,
            ...dynamicInputs
        };

        this.logger.debug(
            `Merged variables: ${JSON.stringify(mergedVariables)}`
        );

        const compiledFormula = this.compiler.compile(formula);

        const result = this.engine.evaluate(
            compiledFormula,
            mergedVariables
        );

        this.logger.log(
            `Billing success run=${processRunId} amount=${result}`
        );

        return result;
    }
}
