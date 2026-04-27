-- AlterTable
ALTER TABLE "ProcessRun" ADD COLUMN     "postProductionLocationId" TEXT,
ADD COLUMN     "preProductionLocationId" TEXT;

-- AddForeignKey
ALTER TABLE "ProcessRun" ADD CONSTRAINT "ProcessRun_preProductionLocationId_fkey" FOREIGN KEY ("preProductionLocationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessRun" ADD CONSTRAINT "ProcessRun_postProductionLocationId_fkey" FOREIGN KEY ("postProductionLocationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;
