import {
    BadRequestException,
    Injectable
} from "@nestjs/common";
import { PrismaService } from "apps/backend/prisma/prisma.service";
import Decimal from "decimal.js";
import { FormulaCompiler } from "../formula/formula-compiler";
import { MathOnlyFormulaEngine } from "../formula/math-only.formula.engine";
import { extractNumericVariables } from "../utils/field-mapper";
import { checksumFormula } from "../utils/formula-checksum";
import { extractFormulaVariables } from "../utils/formula-variable-extractor";
import { ContextLogger } from "../../common/logger/context.logger";

@Injectable()
export class BillingCalculatorService {
    private readonly logger = new ContextLogger(BillingCalculatorService.name);


    constructor(
        private readonly prisma: PrismaService,
        private readonly compiler: FormulaCompiler,
        private readonly engine: MathOnlyFormulaEngine
    ) { }

    async calculateForOrder(
        orderId: string,
        runDynamicInputs: Record<string, Record<string, number>> = {},
        allowDefaults = false
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

                const missingVars: string[] = [];
                for (const v of requiredVars) {
                    if (!(v in staticVars) && !(v in dynamicVars)) {
                        if (allowDefaults) {
                            dynamicVars[v] = 0;
                            this.logger.warn(
                                `Defaulting missing variable "${v}" to 0 for run ${run.id}`
                            );
                        } else {
                            missingVars.push(v);
                        }
                    }
                }

                if (missingVars.length > 0) {
                    throw new BadRequestException(
                        `Missing variable "${missingVars[0]}" for run ${run.id}`
                    );
                }

                const merged = {
                    ...staticVars,
                    ...dynamicVars
                };

                const compiled = this.compiler.compile(formula);
                const value = this.engine.evaluate(compiled, merged);

                merged['__RESULT__'] = value;
                snapshotInputs[run.id] = merged;

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

    //async calculateForGroup(
    //    orders: {
    //        orderId: string;
    //        runInputs: Record<string, Record<string, number>>;
    //    }[]
    //) {
    //    let total = new Decimal(0);
    //    const perOrder: Record<string, any> = {};

    //    for (const { orderId, runInputs } of orders) {
    //        const calc = await this.calculateForOrder(
    //            orderId,
    //            runInputs
    //        );

    //        total = total.plus(calc.result);

    //        perOrder[orderId] = {
    //            result: calc.result,
    //            inputs: calc.inputs,
    //            formula: calc.formula,
    //            checksum: calc.checksum
    //        };
    //    }

    //    return {
    //        result: total,
    //        perOrder,
    //        formula: "GROUP_AGGREGATE",
    //        checksum: checksumFormula("GROUP_AGGREGATE")
    //    };
    //}

    async calculateForGroupFromSnapshots(
        orders: {
            orderId: string;
            inputs: Record<string, Record<string, number>>;
        }[]
    ) {
        this.logger.debug(
            `[calculateForGroupFromSnapshots] orders=${orders.length}`
        );

        let total = new Decimal(0);
        const perOrderCalculations: Record<string, { result: Decimal; inputs: any }> = {};

        for (const o of orders) {
            const calc = await this.calculateForOrder(
                o.orderId,
                o.inputs
            );

            total = total.plus(calc.result);
            perOrderCalculations[o.orderId] = {
                result: calc.result,
                inputs: calc.inputs
            };
        }

        return {
            result: total,
            perOrderCalculations
        };
    }

    calculateRun(run: any) {
        const formula = run.runTemplate.billingFormula;
        if (!formula) return 0;

        const staticVars = extractNumericVariables(
            run.fields as Record<string, unknown>
        );

        const requiredVars = extractFormulaVariables(formula);

        const merged = { ...staticVars };
        for (const v of requiredVars) {
            if (!(v in merged)) {
                merged[v] = 0;
            }
        }

        const compiled = this.compiler.compile(formula);
        return this.engine.evaluate(compiled, merged);
    }

}
