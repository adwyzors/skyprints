/*
  Warnings:

  - You are about to drop the column `lifecycleCompletedProcesses` on the `Order` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Order" DROP COLUMN "lifecycleCompletedProcesses",
ADD COLUMN     "completedProcesses" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "jobCode" TEXT;
