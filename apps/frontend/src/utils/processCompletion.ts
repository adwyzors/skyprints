import { ProcessConfig } from "@/types/planning";

// A process is configured ONLY if ALL its runs are fully filled
export function isProcessConfigured(process: ProcessConfig): boolean {
  if (!process.runs.length) return false;

  return process.runs.every(run =>
    Object.values(run.fields).every(
      v => v !== undefined && v !== ""
    )
  );
}
