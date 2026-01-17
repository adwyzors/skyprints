-- DropIndex
DROP INDEX "OutboxEvent_processed_createdAt_idx";

-- AlterTable
ALTER TABLE "OutboxEvent" ADD COLUMN     "errorMessage" TEXT,
ADD COLUMN     "failed" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "OutboxEvent_processed_failed_createdAt_idx" ON "OutboxEvent"("processed", "failed", "createdAt");
