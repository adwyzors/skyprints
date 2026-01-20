// domain/model/billing.model.ts
export interface BillingSnapshot {
  version: number;
  isLatest: boolean;
  total: {
    amount: string;
    currency: string;
  };
  inputs: Array<{
    runId: string;
    values: Record<string, number>;
  }>;
  calculationType: 'INITIAL' | 'RECALCULATED' | 'MANUAL_ADJUSTMENT' | string; // Add string to union
  createdAt: string;
}