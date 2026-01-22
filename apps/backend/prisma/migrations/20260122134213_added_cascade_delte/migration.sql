-- DropForeignKey
ALTER TABLE "BillingContextOrder" DROP CONSTRAINT "BillingContextOrder_orderId_fkey";

-- DropForeignKey
ALTER TABLE "OrderProcess" DROP CONSTRAINT "OrderProcess_orderId_fkey";

-- DropForeignKey
ALTER TABLE "ProcessRun" DROP CONSTRAINT "ProcessRun_orderProcessId_fkey";

-- DropIndex
DROP INDEX "OrderProcess_orderId_idx";

-- DropIndex
DROP INDEX "OrderProcess_processId_idx";

-- DropIndex
DROP INDEX "OrderProcess_workflowTypeId_idx";

-- DropIndex
DROP INDEX "ProcessRun_assignedUserId_idx";

-- DropIndex
DROP INDEX "ProcessRun_lifecycleWorkflowTypeId_idx";

-- DropIndex
DROP INDEX "ProcessRun_locationId_idx";

-- DropIndex
DROP INDEX "ProcessRun_orderProcessId_idx";

-- DropIndex
DROP INDEX "ProcessRun_runTemplateId_idx";

-- AddForeignKey
ALTER TABLE "OrderProcess" ADD CONSTRAINT "OrderProcess_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessRun" ADD CONSTRAINT "ProcessRun_orderProcessId_fkey" FOREIGN KEY ("orderProcessId") REFERENCES "OrderProcess"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingContextOrder" ADD CONSTRAINT "BillingContextOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
