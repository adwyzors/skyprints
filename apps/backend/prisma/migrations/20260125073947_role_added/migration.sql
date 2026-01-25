/*
  Warnings:

  - Added the required column `role` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "User_isActive_idx";

-- DropIndex
DROP INDEX "User_isActive_name_idx";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "role" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "User_role_isActive_deletedAt_idx" ON "User"("role", "isActive", "deletedAt");

-- CreateIndex
CREATE INDEX "User_name_isActive_deletedAt_idx" ON "User"("name", "isActive", "deletedAt");
