import {
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { OutboxRepository } from './outbox.repository';
import { OutboxHandlers } from './outbox.handlers';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class OutboxProcessor implements OnModuleInit {
  private readonly logger = new Logger(OutboxProcessor.name);
  private polling = false;

  constructor(
    private readonly repo: OutboxRepository,
    private readonly handlers: OutboxHandlers,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    this.startPolling();
  }

  private async startPolling() {
    if (this.polling) return;
    this.polling = true;

    this.logger.log('Outbox processor started');

    while (true) {
      await this.processBatch();
      await this.sleep(1000);
    }
  }

  private async processBatch() {
    await this.prisma.$transaction(async () => {
      const events = await this.repo.fetchUnprocessed(10);

      for (const event of events) {
        try {
          await this.handlers.handle(event);
          await this.repo.markProcessed(event.id);
        } catch (err) {
          this.logger.error(
            `Outbox processing failed: ${event.id}`,
            err instanceof Error ? err.stack : undefined,
          );
        }
      }
    });
  }

  private sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
  }
}
