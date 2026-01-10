// @/types/domain.ts

export interface ProcessRun {
  id: string;
  runNumber: number;
  statusCode: string;
  fields: Record<string, any>;
  location?: string;
  runTemplate:{
    fields:[
      Record<string, any>
    ]
  }
}

export interface Process {
  id: string;
  name: string;
  process:{
   name:string
  }
  quantity: number;
  runs: ProcessRun[];
}

export interface Order {
  id: string;
  orderCode: string;
  customerId: string;
  customer:{
    id:string,
name:string,
code:string
  }
  quantity: number;
  statusCode: string;
  createdAt: string;
  billedAt?: string;
  billingTotal?: number;
  originalTotal?: number;
  processes: Process[];
}