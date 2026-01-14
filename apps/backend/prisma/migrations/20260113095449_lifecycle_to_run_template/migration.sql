-- AlterTable
ALTER TABLE "RunTemplate" ADD COLUMN     "workflowTypeId" TEXT;

-- AddForeignKey
ALTER TABLE "RunTemplate" ADD CONSTRAINT "RunTemplate_workflowTypeId_fkey" FOREIGN KEY ("workflowTypeId") REFERENCES "WorkflowType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
