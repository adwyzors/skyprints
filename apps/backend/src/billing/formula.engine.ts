export interface BillingFormulaEngine {
evaluate(expression: string, variables: Record<string, number>): number;
}