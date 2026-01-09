-- AlterTable
ALTER TABLE "ProcessRun" ADD COLUMN     "statusVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "WorkflowAuditLog" (
    "id" TEXT NOT NULL,
    "workflowTypeId" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "fromStatus" TEXT NOT NULL,
    "toStatus" TEXT NOT NULL,
    "transitionId" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkflowAuditLog_aggregateId_createdAt_idx" ON "WorkflowAuditLog"("aggregateId", "createdAt");

-- AddForeignKey
ALTER TABLE "WorkflowAuditLog" ADD CONSTRAINT "WorkflowAuditLog_workflowTypeId_fkey" FOREIGN KEY ("workflowTypeId") REFERENCES "WorkflowType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
