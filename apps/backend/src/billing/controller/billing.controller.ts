import type {
    CalculateBillingDto, CalculateBillingResponseDto
} from "@app/contracts";
import {
    Body,
    Controller,
    Param,
    Put
} from "@nestjs/common";
import { BillingService } from "../services/billing.service";

@Controller("billing")
export class BillingController {
    constructor(
        private readonly billingService: BillingService
    ) { }

    @Put(":orderProcessId/runs/:processRunId/calculate")
    async calculate(
        @Param("orderProcessId") orderProcessId: string,
        @Param("processRunId") processRunId: string,
        @Body() body: CalculateBillingDto
    ) {
        const amount =
            await this.billingService.calculateWithDynamicInputs(
                orderProcessId,
                processRunId,
                body.dynamicInputs
            );

        return {
            amount,
        } satisfies CalculateBillingResponseDto;
    }
}
