import { Module } from '@nestjs/common';
import { RunFieldsValidator } from './run-fields.validator';
import { RunsController } from './runs.controller';
import { RunsService } from './runs.service';

@Module({
    controllers: [RunsController],
    providers: [
        RunsService,
        RunFieldsValidator,
    ],
})
export class RunsModule { }
