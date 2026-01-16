-- CreateIndex
CREATE INDEX "Location_isActive_idx" ON "Location"("isActive");

-- CreateIndex
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");

-- CreateIndex
CREATE INDEX "Order_customerId_idx" ON "Order"("customerId");

-- CreateIndex
CREATE INDEX "Order_createdById_idx" ON "Order"("createdById");

-- CreateIndex
CREATE INDEX "Order_workflowTypeId_idx" ON "Order"("workflowTypeId");

-- CreateIndex
CREATE INDEX "OrderProcess_orderId_idx" ON "OrderProcess"("orderId");

-- CreateIndex
CREATE INDEX "OrderProcess_processId_idx" ON "OrderProcess"("processId");

-- CreateIndex
CREATE INDEX "OrderProcess_workflowTypeId_idx" ON "OrderProcess"("workflowTypeId");

-- CreateIndex
CREATE INDEX "OutboxEvent_processed_createdAt_idx" ON "OutboxEvent"("processed", "createdAt");

-- CreateIndex
CREATE INDEX "OutboxEvent_aggregateType_aggregateId_idx" ON "OutboxEvent"("aggregateType", "aggregateId");

-- CreateIndex
CREATE INDEX "Process_isEnabled_idx" ON "Process"("isEnabled");

-- CreateIndex
CREATE INDEX "ProcessRun_orderProcessId_idx" ON "ProcessRun"("orderProcessId");

-- CreateIndex
CREATE INDEX "ProcessRun_runTemplateId_idx" ON "ProcessRun"("runTemplateId");

-- CreateIndex
CREATE INDEX "ProcessRun_assignedUserId_idx" ON "ProcessRun"("assignedUserId");

-- CreateIndex
CREATE INDEX "ProcessRun_locationId_idx" ON "ProcessRun"("locationId");

-- CreateIndex
CREATE INDEX "ProcessRun_lifecycleWorkflowTypeId_idx" ON "ProcessRun"("lifecycleWorkflowTypeId");

-- CreateIndex
CREATE INDEX "ProcessRunDefinition_runTemplateId_idx" ON "ProcessRunDefinition"("runTemplateId");

-- CreateIndex
CREATE INDEX "RunTemplate_configWorkflowTypeId_idx" ON "RunTemplate"("configWorkflowTypeId");

-- CreateIndex
CREATE INDEX "RunTemplate_lifecycleWorkflowTypeId_idx" ON "RunTemplate"("lifecycleWorkflowTypeId");

-- CreateIndex
CREATE INDEX "WorkflowAuditLog_workflowTypeId_idx" ON "WorkflowAuditLog"("workflowTypeId");

-- CreateIndex
CREATE INDEX "WorkflowAuditLog_aggregateType_aggregateId_idx" ON "WorkflowAuditLog"("aggregateType", "aggregateId");

-- CreateIndex
CREATE INDEX "WorkflowStatus_workflowTypeId_createdAt_idx" ON "WorkflowStatus"("workflowTypeId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkflowStatus_workflowTypeId_isInitial_idx" ON "WorkflowStatus"("workflowTypeId", "isInitial");

-- CreateIndex
CREATE INDEX "WorkflowTransition_workflowTypeId_idx" ON "WorkflowTransition"("workflowTypeId");

-- CreateIndex
CREATE INDEX "WorkflowTransition_fromStatusId_idx" ON "WorkflowTransition"("fromStatusId");

-- CreateIndex
CREATE INDEX "WorkflowTransition_toStatusId_idx" ON "WorkflowTransition"("toStatusId");
