export interface WorkflowEngine {
  validateTransition(
    workflowTypeCode: string, // e.g. "ORDER" | "PROCESS" | "RUN"
    fromStatusCode: string,
    toStatusCode: string,
    context: Record<string, unknown>,
  ): Promise<void>;
}
