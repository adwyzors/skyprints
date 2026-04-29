import { Module } from '@nestjs/common';
import { RunFieldsValidator } from './run-fields.validator';
import { RunsController } from './runs.controller';
import { RunsService } from './runs.service';
import { BillingModule } from '../billing/billing.module';

@Module({
    imports: [BillingModule],
    controllers: [RunsController],
    providers: [
        RunsService,
        RunFieldsValidator,
    ],
    exports: [RunsService],
})
export class RunsModule { }
