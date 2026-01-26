export interface ProcessRun {
  id: string;
  runNumber: number;
  displayName: string;
  configStatus: string;
  lifecycleStatus: string;
  lifecycle: Array<{
    code: string;
    completed: boolean;
  }>;
  executor?: {
    id: string;
    name: string;
  } | null;
  reviewer?: {
    id: string;
    name: string;
  } | null;
  values: Record<string, string | number | null>; // Changed from fields
  fields: Array<{ // This is now an array, not in runTemplate
    key: string;
    type: string;
    required: boolean;
  }>;
}

export interface RunField {
  key: string;
  type: string;
  required: boolean;
}
