/*
  Warnings:

  - You are about to drop the `OrderSequence` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "OrderSequence";

-- CreateTable
CREATE TABLE "FiscalSequence" (
    "id" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "fiscalYear" TEXT NOT NULL,
    "nextValue" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiscalSequence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FiscalSequence_prefix_fiscalYear_idx" ON "FiscalSequence"("prefix", "fiscalYear");

-- CreateIndex
CREATE UNIQUE INDEX "FiscalSequence_prefix_fiscalYear_key" ON "FiscalSequence"("prefix", "fiscalYear");
