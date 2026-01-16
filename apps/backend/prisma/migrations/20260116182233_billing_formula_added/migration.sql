-- DropIndex
DROP INDEX "RunTemplate_configWorkflowTypeId_idx";

-- DropIndex
DROP INDEX "RunTemplate_lifecycleWorkflowTypeId_idx";

-- AlterTable
ALTER TABLE "RunTemplate" ADD COLUMN     "billingFormula" TEXT;
