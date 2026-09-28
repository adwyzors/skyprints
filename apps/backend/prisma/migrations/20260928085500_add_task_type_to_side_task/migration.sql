-- CreateEnum
CREATE TYPE "SideTaskType" AS ENUM ('FIVE_MIN', 'HALF_HOUR', 'LONG');

-- AlterTable
ALTER TABLE "SideTask" ADD COLUMN "taskType" "SideTaskType" DEFAULT 'FIVE_MIN';
