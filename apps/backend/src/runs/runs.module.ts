import { Module } from '@nestjs/common';
import { RunFieldsValidator } from './run-fields.validator';
import { RunsController } from './runs.controller';
import { RunsService } from './runs.service';
import { OutboxModule } from '../outbox/outbox.module';

@Module({
    controllers: [RunsController],
    providers: [
        RunsService,
        RunFieldsValidator,
    ],
    imports: [OutboxModule]
})
export class RunsModule { }
