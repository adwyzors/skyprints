import { Module } from "@nestjs/common";
import { PrismaService } from "apps/backend/prisma/prisma.service";

import { FormulaCompiler } from "./formula/formula-compiler";
import { MathOnlyFormulaEngine } from "./formula/math-only.formula.engine";

import { OrdersModule } from "../orders/orders.module";
import { BillingContextController } from "./controller/billing-context.controller";
import { BillingController } from "./controller/billing-finalize.controller";
import { BillingCalculatorService } from "./services/billing-calculator.service";
import { BillingContextResolver } from "./services/billing-context.resolver";
import { BillingContextService } from "./services/billing-context.service";
import { BillingSnapshotService } from "./services/billing-snapshot.service";
import { BillingService } from "./services/billing.service";

import { AnalyticsModule } from "../analytics/analytics.module";

@Module({
    controllers: [
        BillingController,
        BillingContextController
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
        BillingContextResolver,
        BillingContextService

    ],
    exports: [
        BillingService
    ],
    imports: [OrdersModule, AnalyticsModule]
})
export class BillingModule { }
