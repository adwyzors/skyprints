-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "creditLimit" DECIMAL(18,4) NOT NULL DEFAULT 0,
ADD COLUMN     "outstandingAmount" DECIMAL(18,4) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "estimatedAmount" DECIMAL(18,4) NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Order_customerId_statusCode_idx" ON "Order"("customerId", "statusCode");
