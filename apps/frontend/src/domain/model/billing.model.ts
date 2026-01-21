// domain/model/billing.model.ts
export interface BillingSnapshot {
  version: number;
  isLatest: boolean;
  result: string;
  currency: string;
  billingContextId?: string;
  type?: string;
  // inputs is an object keyed by runId: { runId: { new_rate: X, quantity: Y, ... } }
  inputs: Record<string, Record<string, number>>;
  calculationType: 'INITIAL' | 'RECALCULATED' | 'MANUAL_ADJUSTMENT' | string;
  createdAt: string;
}