-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "gstno" TEXT,
ADD COLUMN     "tax" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tds" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "OrderProcess" ADD COLUMN     "remainingRuns" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ProcessRun" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "Customer_isActive_name_createdAt_idx" ON "Customer"("isActive", "name", "createdAt");

-- CreateIndex
CREATE INDEX "OrderProcess_remainingRuns_idx" ON "OrderProcess"("remainingRuns");

-- CreateIndex
CREATE INDEX "ProcessRun_createdAt_idx" ON "ProcessRun"("createdAt");
