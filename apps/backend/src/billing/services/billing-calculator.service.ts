import {
    BadRequestException,
    Injectable,
    Logger
} from "@nestjs/common";
import { PrismaService } from "apps/backend/prisma/prisma.service";
import Decimal from "decimal.js";
import { FormulaCompiler } from "../formula/formula-compiler";
import { MathOnlyFormulaEngine } from "../formula/math-only.formula.engine";
import { extractNumericVariables } from "../utils/field-mapper";
import { checksumFormula } from "../utils/formula-checksum";
import { extractFormulaVariables } from "../utils/formula-variable-extractor";

@Injectable()
export class BillingCalculatorService {
    private readonly logger = new Logger(BillingCalculatorService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly compiler: FormulaCompiler,
        private readonly engine: MathOnlyFormulaEngine
    ) { }

    async calculateForOrder(
        orderId: string,
        runDynamicInputs: Record<
            string,
            Record<string, number>
        > = {}
    ) {
        const orderProcesses = await this.prisma.orderProcess.findMany({
            where: { orderId },
            include: {
                runs: {
                    include: { runTemplate: true }
                }
            }
        });

        let total = new Decimal(0);
        const snapshotInputs: Record<string, any> = {};

        for (const op of orderProcesses) {
            for (const run of op.runs) {
                const formula = run.runTemplate.billingFormula;
                if (!formula) continue;

                const staticVars = extractNumericVariables(
                    run.fields as Record<string, unknown>
                );

                const dynamicVars =
                    runDynamicInputs[run.id] ?? {};

                const requiredVars =
                    extractFormulaVariables(formula);

                for (const v of requiredVars) {
                    if (!(v in staticVars) && !(v in dynamicVars)) {
                        throw new BadRequestException(
                            `Missing variable "${v}" for run ${run.id}`
                        );
                    }
                }

                const merged = {
                    ...staticVars,
                    ...dynamicVars
                };

                snapshotInputs[run.id] = merged;

                const compiled = this.compiler.compile(formula);
                const value = this.engine.evaluate(compiled, merged);

                total = total.plus(new Decimal(value));
            }
        }

        return {
            result: total,
            inputs: snapshotInputs,
            formula: "ORDER_AGGREGATE",
            checksum: checksumFormula("ORDER_AGGREGATE")
        };
    }

}
