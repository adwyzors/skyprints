import { Module } from "@nestjs/common";
import { PrismaService } from "apps/backend/prisma/prisma.service";

import { BillingSnapshotController } from "./controller/billing-snapshot.controller";
import { BillingController } from "./controller/billing.controller";

import { FormulaCompiler } from "./formula/formula-compiler";
import { MathOnlyFormulaEngine } from "./formula/math-only.formula.engine";

import { BillingCalculatorService } from "./services/billing-calculator.service";
import { BillingSnapshotService } from "./services/billing-snapshot.service";
import { BillingService } from "./services/billing.service";
import { BillingSnapshotWorker } from "./workers/billing-snapshot.worker";

@Module({
  controllers: [
    BillingController,
    BillingSnapshotController
  ],
  providers: [
    PrismaService,

    // core services
    BillingService,
    BillingCalculatorService,
    BillingSnapshotService,

    // formula
    FormulaCompiler,
    MathOnlyFormulaEngine,

    // worker
    BillingSnapshotWorker
  ],
  exports: [
    BillingSnapshotWorker,
    BillingService
  ]
})
export class BillingModule {}
