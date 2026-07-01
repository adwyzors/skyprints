import { Module } from '@nestjs/common';
import { ProcessesModule } from '../processes/processes.module';
import { ManagerQueueController } from './manager-queue.controller';
import { ManagerQueueService } from './manager-queue.service';

@Module({
  imports: [ProcessesModule],
  controllers: [ManagerQueueController],
  providers: [ManagerQueueService],
  exports: [ManagerQueueService],
})
export class ManagerQueueModule {}
