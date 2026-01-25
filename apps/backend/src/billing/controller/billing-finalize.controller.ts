import type { GetLatestBillingSnapshotDto } from "@app/contracts";
import {
    BadRequestException,
    Body,
    Controller,
    Post
} from "@nestjs/common";
import { BillingSnapshotIntent } from "@prisma/client";
import { RequestContextStore } from "../../common/context/request-context.store";
import { BillingSnapshotService } from "../services/billing-snapshot.service";

@Controller("billing")
export class BillingController {
    constructor(
        private readonly service: BillingSnapshotService
    ) { }


    @Post("finalize/order")
    finalizeOrder(@Body() body: {
        orderId: string;
        inputs: Record<string, Record<string, number>>;
        reason?: string;
    }) {
        const ctx = RequestContextStore.getStore();

        if (!ctx?.user) {
            throw new BadRequestException('User context missing');
        }
        const ctxuser = ctx.user;

        return this.service.finalizeOrder(
            body.orderId,
            body.inputs,
            BillingSnapshotIntent.DRAFT,
            body.reason,
            ctxuser.id,
        );
    }

    @Post("finalize/group")
    finalizeGroup(@Body() body: {
        billingContextId: string;
        inputs: Record<string, Record<string, Record<string, number>>>;

    }) {
        const ctx = RequestContextStore.getStore();

        if (!ctx?.user) {
            throw new BadRequestException('User context missing');
        }
        const ctxuser = ctx.user;

        return this.service.finalizeGroup(
            body.billingContextId,
            body.inputs,
            ctxuser.id
        );
    }


    @Post("snapshots/latest")
    getLatestSnapshot(
        @Body() body: GetLatestBillingSnapshotDto
    ) {
        return this.service.getLatestSnapshot(body);
    }
}
