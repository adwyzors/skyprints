import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class OutboxRepository {
    constructor(private readonly prisma: PrismaService) { }

    fetchUnprocessed(limit: number) {
        return this.prisma.outboxEvent.findMany({
            where: {
                processed: false,
                failed: false,
            },
            orderBy: { createdAt: 'asc' },
            take: limit,
        });
    }

    markProcessed(id: string) {
        return this.prisma.outboxEvent.update({
            where: { id },
            data: { processed: true },
        });
    }

    markFailed(id: string, errorMessage: string) {
        return this.prisma.outboxEvent.update({
            where: { id },
            data: {
                failed: true,
                errorMessage,
            },
        });
    }
}
