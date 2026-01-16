import { Injectable, Logger } from "@nestjs/common";
import { evaluate } from "mathjs";
import { BillingFormulaEngine } from "./billing-formula.engine";

@Injectable()
export class MathOnlyFormulaEngine implements BillingFormulaEngine {
    private readonly logger = new Logger(MathOnlyFormulaEngine.name);

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
