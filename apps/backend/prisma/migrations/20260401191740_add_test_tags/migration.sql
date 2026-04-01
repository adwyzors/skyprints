-- AlterTable
ALTER TABLE "BillingContext" ADD COLUMN     "isTest" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "isTest" BOOLEAN NOT NULL DEFAULT false;
