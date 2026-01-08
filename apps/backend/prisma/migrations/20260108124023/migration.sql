-- CreateTable
CREATE TABLE "WorkflowType" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "WorkflowType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowStatus" (
    "id" TEXT NOT NULL,
    "workflowTypeId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isInitial" BOOLEAN NOT NULL DEFAULT false,
    "isTerminal" BOOLEAN NOT NULL DEFAULT false,

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
CREATE TABLE "Process" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Process_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RunTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fields" JSONB NOT NULL,

    CONSTRAINT "RunTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessRunDefinition" (
    "id" TEXT NOT NULL,
    "processId" TEXT NOT NULL,
    "runTemplateId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "ProcessRunDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "orderCode" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "statusCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderProcess" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "processId" TEXT NOT NULL,
    "statusCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderProcess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessRun" (
    "id" TEXT NOT NULL,
    "orderProcessId" TEXT NOT NULL,
    "runTemplateId" TEXT NOT NULL,
    "runNumber" INTEGER NOT NULL,
    "statusCode" TEXT NOT NULL,
    "fields" JSONB NOT NULL,
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowType_code_key" ON "WorkflowType"("code");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowStatus_workflowTypeId_code_key" ON "WorkflowStatus"("workflowTypeId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowTransition_workflowTypeId_fromStatusId_toStatusId_key" ON "WorkflowTransition"("workflowTypeId", "fromStatusId", "toStatusId");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessRunDefinition_processId_sortOrder_key" ON "ProcessRunDefinition"("processId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderCode_key" ON "Order"("orderCode");

-- CreateIndex
CREATE INDEX "Order_statusCode_idx" ON "Order"("statusCode");

-- CreateIndex
CREATE INDEX "OrderProcess_statusCode_idx" ON "OrderProcess"("statusCode");

-- CreateIndex
CREATE UNIQUE INDEX "OrderProcess_orderId_processId_key" ON "OrderProcess"("orderId", "processId");

-- CreateIndex
CREATE INDEX "ProcessRun_statusCode_idx" ON "ProcessRun"("statusCode");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessRun_orderProcessId_runNumber_key" ON "ProcessRun"("orderProcessId", "runNumber");

-- CreateIndex
CREATE INDEX "OutboxEvent_processed_createdAt_idx" ON "OutboxEvent"("processed", "createdAt");

-- AddForeignKey
ALTER TABLE "WorkflowStatus" ADD CONSTRAINT "WorkflowStatus_workflowTypeId_fkey" FOREIGN KEY ("workflowTypeId") REFERENCES "WorkflowType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowTransition" ADD CONSTRAINT "WorkflowTransition_workflowTypeId_fkey" FOREIGN KEY ("workflowTypeId") REFERENCES "WorkflowType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowTransition" ADD CONSTRAINT "WorkflowTransition_fromStatusId_fkey" FOREIGN KEY ("fromStatusId") REFERENCES "WorkflowStatus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowTransition" ADD CONSTRAINT "WorkflowTransition_toStatusId_fkey" FOREIGN KEY ("toStatusId") REFERENCES "WorkflowStatus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessRunDefinition" ADD CONSTRAINT "ProcessRunDefinition_processId_fkey" FOREIGN KEY ("processId") REFERENCES "Process"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessRunDefinition" ADD CONSTRAINT "ProcessRunDefinition_runTemplateId_fkey" FOREIGN KEY ("runTemplateId") REFERENCES "RunTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderProcess" ADD CONSTRAINT "OrderProcess_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderProcess" ADD CONSTRAINT "OrderProcess_processId_fkey" FOREIGN KEY ("processId") REFERENCES "Process"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessRun" ADD CONSTRAINT "ProcessRun_orderProcessId_fkey" FOREIGN KEY ("orderProcessId") REFERENCES "OrderProcess"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessRun" ADD CONSTRAINT "ProcessRun_runTemplateId_fkey" FOREIGN KEY ("runTemplateId") REFERENCES "RunTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
