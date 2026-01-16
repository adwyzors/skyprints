import type { CreateBillingSnapshotDto } from "@app/contracts";
import {
    Body,
    Controller,
    Get,
    Logger,
    Param,
    Post
} from "@nestjs/common";
import { toBillingSnapshotDto } from "../../mappers/billing-snapshot.mapper";
import { BillingSnapshotService } from "../services/billing-snapshot.service";

@Controller("billing/snapshots")
export class BillingSnapshotController {
    private readonly logger = new Logger(BillingSnapshotController.name);

    constructor(
        private readonly service: BillingSnapshotService
    ) { }

    @Post(":orderId")
    async requestSnapshot(
        @Param("orderId") orderId: string,
        @Body() dto: CreateBillingSnapshotDto
    ) {
        return this.service.createSnapshot(
            orderId,
            dto.runs ?? {},
            dto.reason
        );
    }

    @Get("latest/:orderId")
    async latest(
        @Param("orderId") orderId: string
    ) {
        const snapshot = await this.service.getLatest(orderId);
        return snapshot ? toBillingSnapshotDto(snapshot) : null;
    }

    @Get(":orderId")
    async all(
        @Param("orderId") orderId: string
    ) {
        const snapshots = await this.service.getAll(orderId);
        return snapshots.map(toBillingSnapshotDto);
    }
}
