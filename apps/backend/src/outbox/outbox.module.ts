import { Module } from '@nestjs/common';
import { OutboxService } from './outbox.service';
import { OutboxRepository } from './outbox.repository';
import { OutboxProcessor } from './outbox.processor';
import { OutboxHandlers } from './outbox.handlers';
import { PrismaService } from 'prisma/prisma.service';

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
export class OutboxModule {}
