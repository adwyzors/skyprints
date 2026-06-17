import { Injectable } from '@nestjs/common';
import { evaluate } from 'mathjs';
import { ContextLogger } from '../../common/logger/context.logger';
import { BillingFormulaEngine } from './billing-formula.engine';

@Injectable()
export class MathOnlyFormulaEngine implements BillingFormulaEngine {
  private readonly logger = new ContextLogger(MathOnlyFormulaEngine.name);

  evaluate(expression: string, variables: Record<string, number>): number {
    this.logger.log(
      `Evaluating formula="${expression}" vars=${JSON.stringify(variables)}`,
    );

    return evaluate(expression, variables);
  }
}
