-- AlterTable
ALTER TABLE "ProcessRun" ADD COLUMN     "claimedAt" TIMESTAMP(3),
ADD COLUMN     "claimedBy" TEXT;

-- CreateTable
CREATE TABLE "ManagerStagePermission" (
    "id" TEXT NOT NULL,
    "managerId" TEXT NOT NULL,
    "processId" TEXT NOT NULL,
    "lifecycleStageId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManagerStagePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessRunStageHistory" (
    "id" TEXT NOT NULL,
    "processRunId" TEXT NOT NULL,
    "processId" TEXT NOT NULL,
    "lifecycleStageId" TEXT NOT NULL,
    "managerId" TEXT NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessRunStageHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ManagerStagePermission_managerId_idx" ON "ManagerStagePermission"("managerId");

-- CreateIndex
CREATE INDEX "ManagerStagePermission_processId_lifecycleStageId_idx" ON "ManagerStagePermission"("processId", "lifecycleStageId");

-- CreateIndex
CREATE UNIQUE INDEX "ManagerStagePermission_managerId_processId_lifecycleStageId_key" ON "ManagerStagePermission"("managerId", "processId", "lifecycleStageId");

-- CreateIndex
CREATE INDEX "ProcessRunStageHistory_processRunId_idx" ON "ProcessRunStageHistory"("processRunId");

-- CreateIndex
CREATE INDEX "ProcessRunStageHistory_managerId_completedAt_idx" ON "ProcessRunStageHistory"("managerId", "completedAt");

-- CreateIndex
CREATE INDEX "ProcessRunStageHistory_processId_lifecycleStageId_idx" ON "ProcessRunStageHistory"("processId", "lifecycleStageId");

-- CreateIndex
CREATE INDEX "ProcessRunStageHistory_completedAt_idx" ON "ProcessRunStageHistory"("completedAt");

-- CreateIndex
CREATE INDEX "ProcessRun_claimedBy_idx" ON "ProcessRun"("claimedBy");

-- AddForeignKey
ALTER TABLE "ProcessRun" ADD CONSTRAINT "ProcessRun_claimedBy_fkey" FOREIGN KEY ("claimedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerStagePermission" ADD CONSTRAINT "ManagerStagePermission_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerStagePermission" ADD CONSTRAINT "ManagerStagePermission_processId_fkey" FOREIGN KEY ("processId") REFERENCES "Process"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerStagePermission" ADD CONSTRAINT "ManagerStagePermission_lifecycleStageId_fkey" FOREIGN KEY ("lifecycleStageId") REFERENCES "WorkflowStatus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessRunStageHistory" ADD CONSTRAINT "ProcessRunStageHistory_processRunId_fkey" FOREIGN KEY ("processRunId") REFERENCES "ProcessRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessRunStageHistory" ADD CONSTRAINT "ProcessRunStageHistory_processId_fkey" FOREIGN KEY ("processId") REFERENCES "Process"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessRunStageHistory" ADD CONSTRAINT "ProcessRunStageHistory_lifecycleStageId_fkey" FOREIGN KEY ("lifecycleStageId") REFERENCES "WorkflowStatus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessRunStageHistory" ADD CONSTRAINT "ProcessRunStageHistory_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
