import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class OutboxRepository {
  private readonly logger = new Logger(OutboxRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fetch events with row-level locking (Postgres)
   */
  async fetchUnprocessed(limit = 10) {
    return this.prisma.$queryRawUnsafe<any[]>(`
      SELECT *
      FROM "OutboxEvent"
      WHERE processed = false
      ORDER BY "createdAt"
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    `);
  }

  async markProcessed(id: string) {
    await this.prisma.outboxEvent.update({
      where: { id },
      data: { processed: true },
    });
  }
}
