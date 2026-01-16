import { Module } from "@nestjs/common";
import { BillingController } from "./billing.controller";
import { BillingService } from "./billing.service";
import { FormulaCompiler } from "./formula/formula-compiler";
import { MathOnlyFormulaEngine } from "./formula/math-only.formula.engine";
import { PrismaService } from "apps/backend/prisma/prisma.service";

@Module({
    controllers: [BillingController],
    providers: [
        BillingService,
        MathOnlyFormulaEngine,
        FormulaCompiler,
        PrismaService
    ]
})
export class BillingModule { }
