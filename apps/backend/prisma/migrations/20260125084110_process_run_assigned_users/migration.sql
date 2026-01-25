/*
  Warnings:

  - You are about to drop the column `assignedUserId` on the `ProcessRun` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "ProcessRun" DROP CONSTRAINT "ProcessRun_assignedUserId_fkey";

-- AlterTable
ALTER TABLE "ProcessRun" DROP COLUMN "assignedUserId",
ADD COLUMN     "executorId" TEXT,
ADD COLUMN     "reviewerId" TEXT;

-- AddForeignKey
ALTER TABLE "ProcessRun" ADD CONSTRAINT "ProcessRun_executorId_fkey" FOREIGN KEY ("executorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessRun" ADD CONSTRAINT "ProcessRun_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
