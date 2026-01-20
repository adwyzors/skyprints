import { Logger, Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { OrderRetentionAndSequenceJob } from './order-rentention-sequence.job';

const logger = new Logger('JobsModule');

const jobsEnabled = process.env.JOBS_ENABLED === 'true';

@Module({
    imports: jobsEnabled ? [ScheduleModule.forRoot()] : [],
    providers: jobsEnabled
        ? [OrderRetentionAndSequenceJob]
        : [],
})
export class JobsModule {
    constructor() {
        if (jobsEnabled) {
            logger.log('JobsModule ENABLED');
        } else {
            logger.warn('JobsModule DISABLED via JOBS_ENABLED=false');
        }
    }
}
