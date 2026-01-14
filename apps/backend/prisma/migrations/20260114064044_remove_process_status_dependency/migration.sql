/*
  Warnings:

  - You are about to drop the column `lifecycleWorkflowTypeId` on the `Process` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Process" DROP CONSTRAINT "Process_lifecycleWorkflowTypeId_fkey";

-- AlterTable
ALTER TABLE "Process" DROP COLUMN "lifecycleWorkflowTypeId";
