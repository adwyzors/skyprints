import { Injectable } from "@nestjs/common";
import { evaluate } from "mathjs";
import { BillingFormulaEngine } from "./billing-formula.engine";
import { ContextLogger } from "../../common/logger/context.logger";

@Injectable()
export class MathOnlyFormulaEngine implements BillingFormulaEngine {
    private readonly logger = new ContextLogger(MathOnlyFormulaEngine.name);

    evaluate(
        expression: string,
        variables: Record<string, number>
    ): number {
        this.logger.debug(
            `Evaluating formula="${expression}" vars=${JSON.stringify(variables)}`
        );

        return evaluate(expression, variables);
    }
}
