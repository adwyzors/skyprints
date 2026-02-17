-- CreateTable
CREATE TABLE "LocationAnalytics" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "locationName" TEXT NOT NULL,
    "totalRevenue" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "totalRuns" INTEGER NOT NULL DEFAULT 0,
    "totalUnits" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LocationAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LocationAnalytics_locationId_key" ON "LocationAnalytics"("locationId");

-- CreateIndex
CREATE INDEX "LocationAnalytics_locationId_idx" ON "LocationAnalytics"("locationId");
