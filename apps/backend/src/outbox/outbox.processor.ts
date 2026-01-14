import {
    Injectable,
    Logger,
    OnModuleInit,
} from '@nestjs/common';
import { OutboxHandlers } from './outbox.handlers';
import { OutboxRepository } from './outbox.repository';

@Injectable()
export class OutboxProcessor implements OnModuleInit {
    private readonly logger = new Logger(OutboxProcessor.name);
    private polling = false;

    constructor(
        private readonly repo: OutboxRepository,
        private readonly handlers: OutboxHandlers,
    ) { }

    onModuleInit() {
        this.startPolling();
    }

    private async startPolling() {
        if (this.polling) return;
        this.polling = true;

        this.logger.log('Outbox processor started');

        while (true) {
            try {
                await this.processBatch();
            } catch (err) {
                this.logger.error('Outbox batch failed', err);
            }

            await this.sleep(1000);
        }
    }

    private async processBatch() {
        /**
         * 1. Fetch events (NO TRANSACTION)
         */
        const events = await this.repo.fetchUnprocessed(10);
        if (events.length === 0) return;

        /**
         * 2. Process events independently
         */
        for (const event of events) {
            try {
                await this.handlers.handle(event);

                /**
                 * 3. Mark processed (SHORT, ATOMIC WRITE)
                 */
                await this.repo.markProcessed(event.id);
            } catch (err) {
                this.logger.error(
                    `Outbox processing failed: ${event.id}`,
                    err instanceof Error ? err.stack : undefined,
                );
                // ❗ do NOT mark processed → retry later
            }
        }
    }

    private sleep(ms: number) {
        return new Promise((r) => setTimeout(r, ms));
    }
}
