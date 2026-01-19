-- AlterTable
ALTER TABLE "OrderProcess" ADD COLUMN     "configCompletedAt" TIMESTAMP(3),
ADD COLUMN     "lifecycleCompletionSent" BOOLEAN NOT NULL DEFAULT false;
