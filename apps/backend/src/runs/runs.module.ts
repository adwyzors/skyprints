import { Module } from '@nestjs/common';
import { OutboxModule } from 'src/outbox/outbox.module';
import { RunFieldsValidator } from './run-fields.validator';
import { RunsController } from './runs.controller';
import { RunsService } from './runs.service';

@Module({
    controllers: [RunsController],
    providers: [
        RunsService,
        RunFieldsValidator,
    ],
    imports: [OutboxModule]
})
export class RunsModule { }
