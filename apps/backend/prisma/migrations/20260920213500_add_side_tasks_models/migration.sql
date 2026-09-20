-- CreateEnum
CREATE TYPE "SideTaskStatus" AS ENUM ('ASSIGNED', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "SideTaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "SideTaskStageOutcome" AS ENUM ('COMPLETED', 'REASSIGNED', 'SUBMITTED_FOR_REVIEW', 'RETURNED', 'ABANDONED');

-- CreateTable
CREATE TABLE "SideTaskStageType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SideTaskStageType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SideTask" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" "SideTaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "SideTaskStatus" NOT NULL DEFAULT 'ASSIGNED',
    "requiredBy" TIMESTAMP(3),
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "customerId" TEXT,
    "createdById" TEXT NOT NULL,
    "currentAssigneeId" TEXT,
    "currentStageTypeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "abandonedAt" TIMESTAMP(3),

    CONSTRAINT "SideTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SideTaskStageHistory" (
    "id" TEXT NOT NULL,
    "sideTaskId" TEXT NOT NULL,
    "stageTypeId" TEXT NOT NULL,
    "assignedUserId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "lastStartedAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "totalPausedSeconds" INTEGER NOT NULL DEFAULT 0,
    "totalTimeSeconds" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "completionNote" TEXT,
    "outcome" "SideTaskStageOutcome",
    "reassignmentReason" TEXT,
    "reviewReturnReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SideTaskStageHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SideTaskStageType_code_key" ON "SideTaskStageType"("code");

-- CreateIndex
CREATE INDEX "SideTaskStageType_isActive_idx" ON "SideTaskStageType"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "SideTask_code_key" ON "SideTask"("code");

-- CreateIndex
CREATE INDEX "SideTask_status_requiredBy_idx" ON "SideTask"("status", "requiredBy");

-- CreateIndex
CREATE INDEX "SideTask_currentAssigneeId_status_idx" ON "SideTask"("currentAssigneeId", "status");

-- CreateIndex
CREATE INDEX "SideTask_customerId_idx" ON "SideTask"("customerId");

-- CreateIndex
CREATE INDEX "SideTask_createdById_idx" ON "SideTask"("createdById");

-- CreateIndex
CREATE INDEX "SideTask_completedAt_idx" ON "SideTask"("completedAt");

-- CreateIndex
CREATE INDEX "SideTaskStageHistory_sideTaskId_idx" ON "SideTaskStageHistory"("sideTaskId");

-- CreateIndex
CREATE INDEX "SideTaskStageHistory_assignedUserId_idx" ON "SideTaskStageHistory"("assignedUserId");

-- CreateIndex
CREATE INDEX "SideTaskStageHistory_stageTypeId_idx" ON "SideTaskStageHistory"("stageTypeId");

-- AddForeignKey
ALTER TABLE "SideTask" ADD CONSTRAINT "SideTask_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SideTask" ADD CONSTRAINT "SideTask_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SideTask" ADD CONSTRAINT "SideTask_currentAssigneeId_fkey" FOREIGN KEY ("currentAssigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SideTask" ADD CONSTRAINT "SideTask_currentStageTypeId_fkey" FOREIGN KEY ("currentStageTypeId") REFERENCES "SideTaskStageType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SideTaskStageHistory" ADD CONSTRAINT "SideTaskStageHistory_sideTaskId_fkey" FOREIGN KEY ("sideTaskId") REFERENCES "SideTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SideTaskStageHistory" ADD CONSTRAINT "SideTaskStageHistory_stageTypeId_fkey" FOREIGN KEY ("stageTypeId") REFERENCES "SideTaskStageType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SideTaskStageHistory" ADD CONSTRAINT "SideTaskStageHistory_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
