// domain/model/billing.model.ts
export interface BillingSnapshot {
  version: number;
  isLatest: boolean;
  result: string;
  currency: string;
  billingContextId?: string;
  type?: string;
  isDraft?: boolean;
  // inputs is an object keyed by runId: { runId: { new_rate: X, quantity: Y, ... } }
  inputs: Record<string, Record<string, number>>;
  calculationType: 'INITIAL' | 'RECALCULATED' | 'MANUAL_ADJUSTMENT' | string;
  createdAt: string;
}

export interface BillingContext {
  id: string;
  type: 'GROUP' | 'ORDER';
  name: string;
  description?: string;
  ordersCount: number;
  latestSnapshot?: BillingSnapshot;
}

export interface GetBillingContextsResponse {
  data: BillingContext[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface BillingContextDetails extends BillingContext {
  orders: OrderBillingSummary[];
}

export interface OrderBillingSummary {
  id: string;
  code: string;
  status: string;
  quantity: number;
  customer: {
    name: string;
    code: string;
    tax?: boolean;
    tds?: boolean;
    tdsno?: number | null;
    gstno?: string | null;
    address?: string | null;
    email?: string | null;
    phone?: string | null;
  };
  processes: {
    id: string;
    name: string;
    runs: {
      id: string;
      name: string;
      configStatus: string;
      values?: Record<string, any>;
    }[];
  }[];
  billing: {
    id: string;
    result: string;
    currency: string;
    inputs: Record<string, any>;
  } | null;
}