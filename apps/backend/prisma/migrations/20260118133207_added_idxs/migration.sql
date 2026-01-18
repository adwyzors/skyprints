-- DropIndex
DROP INDEX "Order_code_idx";

-- CreateIndex
CREATE INDEX "Customer_isActive_idx" ON "Customer"("isActive");

-- CreateIndex
CREATE INDEX "User_isActive_idx" ON "User"("isActive");

-- CreateIndex
CREATE INDEX "WorkflowStatus_workflowTypeId_isTerminal_idx" ON "WorkflowStatus"("workflowTypeId", "isTerminal");

-- CreateIndex
CREATE INDEX "WorkflowType_isActive_idx" ON "WorkflowType"("isActive");
