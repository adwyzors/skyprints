/*
  Warnings:

  - Added the required column `displayName` to the `ProcessRun` table without a default value. This is not possible if the table is not empty.
  - Added the required column `displayName` to the `ProcessRunDefinition` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Process" ALTER COLUMN "isEnabled" SET DEFAULT false;

-- AlterTable
ALTER TABLE "ProcessRun" ADD COLUMN     "displayName" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "ProcessRunDefinition" ADD COLUMN     "displayName" TEXT NOT NULL;
