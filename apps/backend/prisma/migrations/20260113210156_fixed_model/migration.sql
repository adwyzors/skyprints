/*
  Warnings:

  - You are about to drop the column `orderCode` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `totalAmount` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `OrderProcess` table. All the data in the column will be lost.
  - You are about to drop the column `maxRuns` on the `OrderProcess` table. All the data in the column will be lost.
  - You are about to drop the column `minRuns` on the `OrderProcess` table. All the data in the column will be lost.
  - You are about to drop the column `progress` on the `OrderProcess` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `OrderProcess` table. All the data in the column will be lost.
  - You are about to drop the column `error` on the `OutboxEvent` table. All the data in the column will be lost.
  - You are about to drop the column `retryCount` on the `OutboxEvent` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `OutboxEvent` table. All the data in the column will be lost.
  - You are about to drop the column `isEnabled` on the `Process` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Process` table. All the data in the column will be lost.
  - You are about to drop the column `workflowTypeId` on the `Process` table. All the data in the column will be lost.
  - You are about to drop the column `assignedToId` on the `ProcessRun` table. All the data in the column will be lost.
  - You are about to drop the column `completedAt` on the `ProcessRun` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `ProcessRun` table. All the data in the column will be lost.
  - You are about to drop the column `startedAt` on the `ProcessRun` table. All the data in the column will be lost.
  - You are about to drop the column `statusVersion` on the `ProcessRun` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `ProcessRun` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `ProcessRunDefinition` table. All the data in the column will be lost.
  - You are about to drop the column `workflowTypeId` on the `RunTemplate` table. All the data in the column will be lost.
  - You are about to drop the column `payload` on the `WorkflowAuditLog` table. All the data in the column will be lost.
  - You are about to drop the column `transitionId` on the `WorkflowAuditLog` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `WorkflowAuditLog` table. All the data in the column will be lost.
  - You are about to drop the column `color` on the `WorkflowStatus` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `WorkflowStatus` table. All the data in the column will be lost.
  - You are about to drop the column `icon` on the `WorkflowStatus` table. All the data in the column will be lost.
  - You are about to drop the column `condition` on the `WorkflowTransition` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `WorkflowTransition` table. All the data in the column will be lost.
  - You are about to drop the column `isParallel` on the `WorkflowTransition` table. All the data in the column will be lost.
  - Added the required column `createdById` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `workflowTypeId` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lifecycleWorkflowTypeId` to the `Process` table without a default value. This is not possible if the table is not empty.
  - Added the required column `configWorkflowTypeId` to the `ProcessRun` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lifeCycleStatusCode` to the `ProcessRun` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lifecycleWorkflowTypeId` to the `ProcessRun` table without a default value. This is not possible if the table is not empty.
  - Added the required column `configWorkflowTypeId` to the `RunTemplate` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lifecycleWorkflowTypeId` to the `RunTemplate` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_userId_fkey";

-- DropForeignKey
ALTER TABLE "OrderProcess" DROP CONSTRAINT "OrderProcess_workflowTypeId_fkey";

-- DropForeignKey
ALTER TABLE "Process" DROP CONSTRAINT "Process_workflowTypeId_fkey";

-- DropForeignKey
ALTER TABLE "ProcessRun" DROP CONSTRAINT "ProcessRun_assignedToId_fkey";

-- DropForeignKey
ALTER TABLE "RunTemplate" DROP CONSTRAINT "RunTemplate_workflowTypeId_fkey";

-- DropIndex
DROP INDEX "Order_createdAt_idx";

-- DropIndex
DROP INDEX "Order_customerId_idx";

-- DropIndex
DROP INDEX "Order_orderCode_key";

-- DropIndex
DROP INDEX "Order_statusCode_idx";

-- DropIndex
DROP INDEX "OutboxEvent_processed_createdAt_idx";

-- DropIndex
DROP INDEX "ProcessRun_assignedToId_idx";

-- DropIndex
DROP INDEX "ProcessRun_locationId_idx";

-- DropIndex
DROP INDEX "ProcessRun_statusCode_idx";

-- DropIndex
DROP INDEX "WorkflowAuditLog_aggregateId_createdAt_idx";

-- DropIndex
DROP INDEX "WorkflowAuditLog_userId_idx";

-- DropIndex
DROP INDEX "WorkflowAuditLog_workflowTypeId_idx";

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "orderCode",
DROP COLUMN "totalAmount",
DROP COLUMN "updatedAt",
DROP COLUMN "userId",
ADD COLUMN     "createdById" TEXT NOT NULL,
ADD COLUMN     "workflowTypeId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "OrderProcess" DROP COLUMN "createdAt",
DROP COLUMN "maxRuns",
DROP COLUMN "minRuns",
DROP COLUMN "progress",
DROP COLUMN "updatedAt";

-- AlterTable
ALTER TABLE "OutboxEvent" DROP COLUMN "error",
DROP COLUMN "retryCount",
DROP COLUMN "updatedAt";

-- AlterTable
ALTER TABLE "Process" DROP COLUMN "isEnabled",
DROP COLUMN "updatedAt",
DROP COLUMN "workflowTypeId",
ADD COLUMN     "lifecycleWorkflowTypeId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "ProcessRun" DROP COLUMN "assignedToId",
DROP COLUMN "completedAt",
DROP COLUMN "createdAt",
DROP COLUMN "startedAt",
DROP COLUMN "statusVersion",
DROP COLUMN "updatedAt",
ADD COLUMN     "assignedUserId" TEXT,
ADD COLUMN     "configWorkflowTypeId" TEXT NOT NULL,
ADD COLUMN     "lifeCycleStatusCode" TEXT NOT NULL,
ADD COLUMN     "lifecycleWorkflowTypeId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "ProcessRunDefinition" DROP COLUMN "createdAt";

-- AlterTable
ALTER TABLE "RunTemplate" DROP COLUMN "workflowTypeId",
ADD COLUMN     "configWorkflowTypeId" TEXT NOT NULL,
ADD COLUMN     "lifecycleWorkflowTypeId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "WorkflowAuditLog" DROP COLUMN "payload",
DROP COLUMN "transitionId",
DROP COLUMN "userId";

-- AlterTable
ALTER TABLE "WorkflowStatus" DROP COLUMN "color",
DROP COLUMN "createdAt",
DROP COLUMN "icon";

-- AlterTable
ALTER TABLE "WorkflowTransition" DROP COLUMN "condition",
DROP COLUMN "createdAt",
DROP COLUMN "isParallel";

-- AddForeignKey
ALTER TABLE "RunTemplate" ADD CONSTRAINT "RunTemplate_configWorkflowTypeId_fkey" FOREIGN KEY ("configWorkflowTypeId") REFERENCES "WorkflowType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunTemplate" ADD CONSTRAINT "RunTemplate_lifecycleWorkflowTypeId_fkey" FOREIGN KEY ("lifecycleWorkflowTypeId") REFERENCES "WorkflowType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Process" ADD CONSTRAINT "Process_lifecycleWorkflowTypeId_fkey" FOREIGN KEY ("lifecycleWorkflowTypeId") REFERENCES "WorkflowType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessRun" ADD CONSTRAINT "ProcessRun_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
