import type { GetLatestBillingSnapshotDto } from "@app/contracts";
import {
    Body,
    Controller,
    Post
} from "@nestjs/common";
import { BillingSnapshotService } from "../services/billing-snapshot.service";

@Controller("billing")
export class BillingController {
    constructor(
        private readonly service: BillingSnapshotService
    ) { }

    @Post("draft")
    saveDraft(@Body() body: {
        billingContextId: string;
        inputs: any;
        reason?: string;
    }) {
        return this.service.saveDraft(
            body.billingContextId,
            body.inputs,
            body.reason
        );
    }

    @Post("finalize/order")
    finalizeOrder(@Body() body: {
        orderId: string;
        inputs: Record<string, Record<string, number>>;
        reason?: string;
    }) {
        return this.service.finalizeOrder(
            body.orderId,
            body.inputs,
            body.reason
        );
    }

    @Post("finalize/group")
    finalizeGroup(@Body() body: {
        billingContextId: string;
        inputs: Record<string, Record<string, Record<string, number>>>;
    }) {
        return this.service.finalizeGroup(
            body.billingContextId,
            body.inputs
        );
    }


    @Post("snapshots/latest")
    getLatestSnapshot(
        @Body() body: GetLatestBillingSnapshotDto
    ) {
        return this.service.getLatestSnapshot(body);
    }
}
