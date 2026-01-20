-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "lifecycleCompletedProcesses" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalProcesses" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "OrderProcess" ADD COLUMN     "configCompletedRuns" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lifecycleCompletedAt" TIMESTAMP(3),
ADD COLUMN     "lifecycleCompletedRuns" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalRuns" INTEGER NOT NULL DEFAULT 0;
