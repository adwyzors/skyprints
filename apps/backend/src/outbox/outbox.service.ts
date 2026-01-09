import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class OutboxService {//TODO: make transactions
    //add permissions to routes
    //add pagination to get all apis
    private readonly logger = new Logger(OutboxService.name);

    constructor(private readonly prisma: PrismaService) { }

    async add(event: {
        aggregateType: string;
        aggregateId: string;
        eventType: string;
        payload: unknown;
    }): Promise<void> {
        await this.prisma.outboxEvent.create({
            data: {
                aggregateType: event.aggregateType,
                aggregateId: event.aggregateId,
                eventType: event.eventType,
                payload: event.payload as any,
            },
        });

        this.logger.log(
            `Outbox event created | ${event.eventType} | ${event.aggregateId}`,
        );
    }
}
