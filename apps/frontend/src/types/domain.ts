// @/types/domain.ts

export interface ProcessRun {
  id: string;
  runNumber: number;
  status: string;
  fields: Record<string, any>;
  location?: string; // New: location field for each run
}

export interface Process {
  id: string;
  name: string;
  quantity: number;
  runs: ProcessRun[];
}

export interface Order {
  id: string;
  orderCode: string;
  customerId: string;
  customerName: string;
  customerCode: string;
  quantity: number;
  status: string;
  createdAt: string;
  processes: Process[];
}