/*
  Warnings:

  - You are about to drop the column `finalizedAt` on the `BillingContext` table. All the data in the column will be lost.
  - You are about to drop the column `isFinalized` on the `BillingContext` table. All the data in the column will be lost.
  - You are about to drop the column `metadata` on the `BillingContext` table. All the data in the column will be lost.
  - You are about to drop the column `state` on the `BillingSnapshot` table. All the data in the column will be lost.
  - Added the required column `intent` to the `BillingSnapshot` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "BillingSnapshotIntent" AS ENUM ('DRAFT', 'FINAL');

-- DropIndex
DROP INDEX "BillingContext_isFinalized_idx";

-- DropIndex
DROP INDEX "BillingContextOrder_orderId_idx";

-- DropIndex
DROP INDEX "BillingSnapshot_state_idx";

-- AlterTable
ALTER TABLE "BillingContext" DROP COLUMN "finalizedAt",
DROP COLUMN "isFinalized",
DROP COLUMN "metadata";

-- AlterTable
ALTER TABLE "BillingSnapshot" DROP COLUMN "state",
ADD COLUMN     "intent" "BillingSnapshotIntent" NOT NULL;

-- DropEnum
DROP TYPE "BillingSnapshotState";
