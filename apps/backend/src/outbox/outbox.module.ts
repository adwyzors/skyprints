import { Module } from '@nestjs/common';
import { PrismaService } from 'apps/backend/prisma/prisma.service';
import { BillingModule } from '../billing/billing.module';
import { OutboxHandlers } from './outbox.handlers';
import { OutboxProcessor } from './outbox.processor';
import { OutboxRepository } from './outbox.repository';
import { OutboxService } from './outbox.service';

@Module({
    providers: [
        OutboxService,
        OutboxRepository,
        OutboxHandlers,
        OutboxProcessor,
        PrismaService
    ],
    exports: [OutboxService],
})
export class OutboxModule { }
