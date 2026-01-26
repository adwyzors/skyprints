import { Module } from '@nestjs/common';
//import { OrderRetentionAndSequenceJob } from './order-rentention-sequence.job';
import { ContextLogger } from '../common/logger/context.logger';

const logger = new ContextLogger('JobsModule');

const jobsEnabled = process.env.JOBS_ENABLED === 'true';

@Module({
    //imports: jobsEnabled ? [ScheduleModule.forRoot()] : [],
    //providers: jobsEnabled
    //    ? [OrderRetentionAndSequenceJob]
    //    : [],
})
export class JobsModule {
    constructor() {
        //if (jobsEnabled) {
        //    logger.log('JobsModule ENABLED');
        //} else {
        //    logger.warn('JobsModule DISABLED via JOBS_ENABLED=false');
        //}
    }
}
