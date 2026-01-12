-- DropForeignKey
ALTER TABLE "Process" DROP CONSTRAINT "Process_workflowTypeId_fkey";

-- AlterTable
ALTER TABLE "Process" ALTER COLUMN "workflowTypeId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Process" ADD CONSTRAINT "Process_workflowTypeId_fkey" FOREIGN KEY ("workflowTypeId") REFERENCES "WorkflowType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
