-- CreateTable
CREATE TABLE "ProcessRunLifecycleHistory" (
    "id" TEXT NOT NULL,
    "processRunId" TEXT NOT NULL,
    "statusCode" TEXT NOT NULL,
    "expectedDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessRunLifecycleHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProcessRunLifecycleHistory_processRunId_idx" ON "ProcessRunLifecycleHistory"("processRunId");

-- CreateIndex
CREATE INDEX "ProcessRunLifecycleHistory_statusCode_idx" ON "ProcessRunLifecycleHistory"("statusCode");

-- AddForeignKey
ALTER TABLE "ProcessRunLifecycleHistory" ADD CONSTRAINT "ProcessRunLifecycleHistory_processRunId_fkey" FOREIGN KEY ("processRunId") REFERENCES "ProcessRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
