-- CreateTable
CREATE TABLE "DailyAnalytics" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "totalRevenue" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "totalOrders" INTEGER NOT NULL DEFAULT 0,
    "totalUnits" INTEGER NOT NULL DEFAULT 0,
    "billedRevenue" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "billedOrders" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessAnalytics" (
    "id" TEXT NOT NULL,
    "processId" TEXT NOT NULL,
    "processName" TEXT NOT NULL,
    "totalRevenue" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "totalRuns" INTEGER NOT NULL DEFAULT 0,
    "totalUnits" INTEGER NOT NULL DEFAULT 0,
    "avgLeadTime" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcessAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPerformance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "runsExecuted" INTEGER NOT NULL DEFAULT 0,
    "runsReviewed" INTEGER NOT NULL DEFAULT 0,
    "totalBilledVolume" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPerformance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderAnalytics" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderCode" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "totalAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "totalUnits" INTEGER NOT NULL,
    "cycleTimeHours" DOUBLE PRECISION,
    "status" TEXT NOT NULL,
    "billedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyAnalytics_date_key" ON "DailyAnalytics"("date");

-- CreateIndex
CREATE INDEX "DailyAnalytics_date_idx" ON "DailyAnalytics"("date");

-- CreateIndex
CREATE INDEX "ProcessAnalytics_processId_idx" ON "ProcessAnalytics"("processId");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessAnalytics_processId_key" ON "ProcessAnalytics"("processId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPerformance_userId_key" ON "UserPerformance"("userId");

-- CreateIndex
CREATE INDEX "UserPerformance_userId_idx" ON "UserPerformance"("userId");

-- CreateIndex
CREATE INDEX "UserPerformance_role_idx" ON "UserPerformance"("role");

-- CreateIndex
CREATE UNIQUE INDEX "OrderAnalytics_orderId_key" ON "OrderAnalytics"("orderId");

-- CreateIndex
CREATE INDEX "OrderAnalytics_orderId_idx" ON "OrderAnalytics"("orderId");

-- CreateIndex
CREATE INDEX "OrderAnalytics_customerId_idx" ON "OrderAnalytics"("customerId");

-- CreateIndex
CREATE INDEX "OrderAnalytics_status_idx" ON "OrderAnalytics"("status");
