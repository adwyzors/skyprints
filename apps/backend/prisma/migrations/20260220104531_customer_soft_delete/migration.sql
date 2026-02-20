-- DropIndex
DROP INDEX "Customer_isActive_name_createdAt_idx";

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Customer_deletedAt_idx" ON "Customer"("deletedAt");

-- CreateIndex
CREATE INDEX "Customer_isActive_deletedAt_idx" ON "Customer"("isActive", "deletedAt");

-- CreateIndex
CREATE INDEX "Customer_isActive_name_createdAt_deletedAt_idx" ON "Customer"("isActive", "name", "createdAt", "deletedAt");
