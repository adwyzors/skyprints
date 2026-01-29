-- DropIndex
DROP INDEX "User_locationId_key";

-- CreateIndex
CREATE INDEX "User_locationId_idx" ON "User"("locationId");
