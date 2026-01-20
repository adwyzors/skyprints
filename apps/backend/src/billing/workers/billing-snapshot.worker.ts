import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "apps/backend/prisma/prisma.service";
import { console } from "inspector";
import { BillingCalculatorService } from "../services/billing-calculator.service";

@Injectable()
export class BillingSnapshotWorker {
    private readonly logger = new Logger(BillingSnapshotWorker.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly calculator: BillingCalculatorService
    ) { }

    async handle(event: any) {

    }
}
