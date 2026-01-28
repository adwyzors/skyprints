-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('CONFIGURE', 'PRODUCTION_READY', 'IN_PRODUCTION', 'COMPLETE', 'BILLED', 'GROUP_BILLED');

-- CreateEnum
CREATE TYPE "OrderProcessStatus" AS ENUM ('CONFIGURE', 'IN_PROGRESS', 'COMPLETE');

-- CreateEnum
CREATE TYPE "ProcessRunStatus" AS ENUM ('CONFIGURE', 'IN_PROGRESS', 'COMPLETE');

-- CreateEnum
CREATE TYPE "BillingContextType" AS ENUM ('ORDER', 'GROUP');

-- CreateEnum
CREATE TYPE "BillingSnapshotIntent" AS ENUM ('DRAFT', 'FINAL');

-- CreateEnum
CREATE TYPE "CalculationType" AS ENUM ('INITIAL', 'RECALCULATED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "locationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "role" TEXT NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderSequence" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "nextValue" INTEGER NOT NULL,
    "lastResetAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowType" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowStatus" (
    "id" TEXT NOT NULL,
    "workflowTypeId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isInitial" BOOLEAN NOT NULL DEFAULT false,
    "isTerminal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowTransition" (
    "id" TEXT NOT NULL,
    "workflowTypeId" TEXT NOT NULL,
    "fromStatusId" TEXT NOT NULL,
    "toStatusId" TEXT NOT NULL,
    "condition" TEXT,

    CONSTRAINT "WorkflowTransition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RunTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fields" JSONB NOT NULL,
    "billingFormula" TEXT,
    "configWorkflowTypeId" TEXT NOT NULL,
    "lifecycleWorkflowTypeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RunTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Process" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Process_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessRunDefinition" (
    "id" TEXT NOT NULL,
    "processId" TEXT NOT NULL,
    "runTemplateId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "ProcessRunDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "customerId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "statusCode" "OrderStatus" NOT NULL,
    "jobCode" TEXT,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdById" TEXT NOT NULL,
    "totalProcesses" INTEGER NOT NULL DEFAULT 0,
    "completedProcesses" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lifecycleStartedAt" TIMESTAMP(3),

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderProcess" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "processId" TEXT NOT NULL,
    "statusCode" "OrderProcessStatus" NOT NULL,
    "totalRuns" INTEGER NOT NULL DEFAULT 0,
    "configCompletedRuns" INTEGER NOT NULL DEFAULT 0,
    "lifecycleCompletedRuns" INTEGER NOT NULL DEFAULT 0,
    "configCompletedAt" TIMESTAMP(3),
    "lifecycleCompletedAt" TIMESTAMP(3),

    CONSTRAINT "OrderProcess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessRun" (
    "id" TEXT NOT NULL,
    "orderProcessId" TEXT NOT NULL,
    "runTemplateId" TEXT NOT NULL,
    "runNumber" INTEGER NOT NULL,
    "displayName" TEXT NOT NULL,
    "configWorkflowTypeId" TEXT NOT NULL,
    "lifecycleWorkflowTypeId" TEXT NOT NULL,
    "statusCode" "ProcessRunStatus" NOT NULL,
    "lifeCycleStatusCode" TEXT NOT NULL,
    "fields" JSONB NOT NULL,
    "executorId" TEXT,
    "reviewerId" TEXT,
    "locationId" TEXT,

    CONSTRAINT "ProcessRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'WORKSTATION',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingContext" (
    "id" TEXT NOT NULL,
    "type" "BillingContextType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingContext_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingContextOrder" (
    "id" TEXT NOT NULL,
    "billingContextId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingContextOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingSnapshot" (
    "id" TEXT NOT NULL,
    "billingContextId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "isLatest" BOOLEAN NOT NULL DEFAULT true,
    "intent" "BillingSnapshotIntent" NOT NULL,
    "inputs" JSONB NOT NULL,
    "result" DECIMAL(18,4) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "calculationType" "CalculationType" NOT NULL,
    "reason" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_locationId_key" ON "User"("locationId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_isActive_deletedAt_idx" ON "User"("role", "isActive", "deletedAt");

-- CreateIndex
CREATE INDEX "User_name_isActive_deletedAt_idx" ON "User"("name", "isActive", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_code_key" ON "Customer"("code");

-- CreateIndex
CREATE INDEX "Customer_isActive_idx" ON "Customer"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowType_code_key" ON "WorkflowType"("code");

-- CreateIndex
CREATE INDEX "WorkflowType_isActive_idx" ON "WorkflowType"("isActive");

-- CreateIndex
CREATE INDEX "WorkflowStatus_workflowTypeId_code_idx" ON "WorkflowStatus"("workflowTypeId", "code");

-- CreateIndex
CREATE INDEX "WorkflowStatus_workflowTypeId_createdAt_idx" ON "WorkflowStatus"("workflowTypeId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkflowStatus_workflowTypeId_isInitial_idx" ON "WorkflowStatus"("workflowTypeId", "isInitial");

-- CreateIndex
CREATE INDEX "WorkflowStatus_workflowTypeId_isTerminal_idx" ON "WorkflowStatus"("workflowTypeId", "isTerminal");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowStatus_workflowTypeId_code_key" ON "WorkflowStatus"("workflowTypeId", "code");

-- CreateIndex
CREATE INDEX "WorkflowTransition_workflowTypeId_idx" ON "WorkflowTransition"("workflowTypeId");

-- CreateIndex
CREATE INDEX "WorkflowTransition_fromStatusId_idx" ON "WorkflowTransition"("fromStatusId");

-- CreateIndex
CREATE INDEX "WorkflowTransition_toStatusId_idx" ON "WorkflowTransition"("toStatusId");

-- CreateIndex
CREATE INDEX "WorkflowTransition_fromStatusId_toStatusId_idx" ON "WorkflowTransition"("fromStatusId", "toStatusId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowTransition_workflowTypeId_fromStatusId_toStatusId_key" ON "WorkflowTransition"("workflowTypeId", "fromStatusId", "toStatusId");

-- CreateIndex
CREATE INDEX "RunTemplate_configWorkflowTypeId_idx" ON "RunTemplate"("configWorkflowTypeId");

-- CreateIndex
CREATE INDEX "RunTemplate_lifecycleWorkflowTypeId_idx" ON "RunTemplate"("lifecycleWorkflowTypeId");

-- CreateIndex
CREATE INDEX "Process_isEnabled_idx" ON "Process"("isEnabled");

-- CreateIndex
CREATE INDEX "ProcessRunDefinition_runTemplateId_idx" ON "ProcessRunDefinition"("runTemplateId");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessRunDefinition_processId_sortOrder_key" ON "ProcessRunDefinition"("processId", "sortOrder");

-- CreateIndex
CREATE INDEX "Order_id_deletedAt_idx" ON "Order"("id", "deletedAt");

-- CreateIndex
CREATE INDEX "Order_deletedAt_createdAt_idx" ON "Order"("deletedAt", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Order_deletedAt_statusCode_idx" ON "Order"("deletedAt", "statusCode");

-- CreateIndex
CREATE INDEX "Order_deletedAt_customerId_createdAt_idx" ON "Order"("deletedAt", "customerId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Order_deletedAt_statusCode_createdAt_idx" ON "Order"("deletedAt", "statusCode", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Order_deletedAt_createdById_idx" ON "Order"("deletedAt", "createdById");

-- CreateIndex
CREATE UNIQUE INDEX "Order_code_deletedAt_key" ON "Order"("code", "deletedAt");

-- CreateIndex
CREATE INDEX "OrderProcess_lifecycleCompletedRuns_totalRuns_idx" ON "OrderProcess"("lifecycleCompletedRuns", "totalRuns");

-- CreateIndex
CREATE UNIQUE INDEX "OrderProcess_orderId_processId_key" ON "OrderProcess"("orderId", "processId");

-- CreateIndex
CREATE INDEX "ProcessRun_orderProcessId_id_idx" ON "ProcessRun"("orderProcessId", "id");

-- CreateIndex
CREATE INDEX "ProcessRun_orderProcessId_lifeCycleStatusCode_idx" ON "ProcessRun"("orderProcessId", "lifeCycleStatusCode");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessRun_orderProcessId_runNumber_key" ON "ProcessRun"("orderProcessId", "runNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Location_code_key" ON "Location"("code");

-- CreateIndex
CREATE INDEX "Location_isActive_idx" ON "Location"("isActive");

-- CreateIndex
CREATE INDEX "BillingContext_type_idx" ON "BillingContext"("type");

-- CreateIndex
CREATE INDEX "BillingContext_id_idx" ON "BillingContext"("id");

-- CreateIndex
CREATE UNIQUE INDEX "BillingContextOrder_billingContextId_orderId_key" ON "BillingContextOrder"("billingContextId", "orderId");

-- CreateIndex
CREATE INDEX "BillingSnapshot_billingContextId_isLatest_idx" ON "BillingSnapshot"("billingContextId", "isLatest");

-- CreateIndex
CREATE INDEX "BillingSnapshot_billingContextId_intent_isLatest_idx" ON "BillingSnapshot"("billingContextId", "intent", "isLatest");

-- CreateIndex
CREATE INDEX "BillingSnapshot_billingContextId_version_idx" ON "BillingSnapshot"("billingContextId", "version");

-- CreateIndex
CREATE INDEX "BillingSnapshot_intent_idx" ON "BillingSnapshot"("intent");

-- CreateIndex
CREATE UNIQUE INDEX "BillingSnapshot_billingContextId_version_key" ON "BillingSnapshot"("billingContextId", "version");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowStatus" ADD CONSTRAINT "WorkflowStatus_workflowTypeId_fkey" FOREIGN KEY ("workflowTypeId") REFERENCES "WorkflowType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowTransition" ADD CONSTRAINT "WorkflowTransition_workflowTypeId_fkey" FOREIGN KEY ("workflowTypeId") REFERENCES "WorkflowType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowTransition" ADD CONSTRAINT "WorkflowTransition_fromStatusId_fkey" FOREIGN KEY ("fromStatusId") REFERENCES "WorkflowStatus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowTransition" ADD CONSTRAINT "WorkflowTransition_toStatusId_fkey" FOREIGN KEY ("toStatusId") REFERENCES "WorkflowStatus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunTemplate" ADD CONSTRAINT "RunTemplate_configWorkflowTypeId_fkey" FOREIGN KEY ("configWorkflowTypeId") REFERENCES "WorkflowType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunTemplate" ADD CONSTRAINT "RunTemplate_lifecycleWorkflowTypeId_fkey" FOREIGN KEY ("lifecycleWorkflowTypeId") REFERENCES "WorkflowType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessRunDefinition" ADD CONSTRAINT "ProcessRunDefinition_processId_fkey" FOREIGN KEY ("processId") REFERENCES "Process"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessRunDefinition" ADD CONSTRAINT "ProcessRunDefinition_runTemplateId_fkey" FOREIGN KEY ("runTemplateId") REFERENCES "RunTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderProcess" ADD CONSTRAINT "OrderProcess_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderProcess" ADD CONSTRAINT "OrderProcess_processId_fkey" FOREIGN KEY ("processId") REFERENCES "Process"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessRun" ADD CONSTRAINT "ProcessRun_executorId_fkey" FOREIGN KEY ("executorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessRun" ADD CONSTRAINT "ProcessRun_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessRun" ADD CONSTRAINT "ProcessRun_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessRun" ADD CONSTRAINT "ProcessRun_orderProcessId_fkey" FOREIGN KEY ("orderProcessId") REFERENCES "OrderProcess"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessRun" ADD CONSTRAINT "ProcessRun_runTemplateId_fkey" FOREIGN KEY ("runTemplateId") REFERENCES "RunTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingContextOrder" ADD CONSTRAINT "BillingContextOrder_billingContextId_fkey" FOREIGN KEY ("billingContextId") REFERENCES "BillingContext"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingContextOrder" ADD CONSTRAINT "BillingContextOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingSnapshot" ADD CONSTRAINT "BillingSnapshot_billingContextId_fkey" FOREIGN KEY ("billingContextId") REFERENCES "BillingContext"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
