// apps/backend/src/app.module.ts
import { Module } from '@nestjs/common';

import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { UserModule } from './user/user.module';

import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../prisma/prisma.module';
import { BillingModule } from './billing/billing.module';
import { CustomersModule } from './customers/customers.module';
import { JobsModule } from './jobs/jobs.module';
import { OrdersModule } from './orders/orders.module';
import { ProcessesModule } from './processes/processes.module';
import { RunTemplatesModule } from './run-templates/run-templates.module';
import { RunsModule } from './runs/runs.module';
import { WorkflowModule } from './workflow/workflow.module';

@Module({
    imports: [ConfigModule.forRoot({
        isGlobal: true, // VERY IMPORTANT
        envFilePath: [
            '.env',
            `apps/backend/.env.${process.env.NODE_ENV || 'local'}`,
        ]
    }), PrismaModule,
    ScheduleModule.forRoot(),
        WorkflowModule,
        OrdersModule,
        RunsModule,
        AuthModule,
        UserModule,
        ProcessesModule,
        RunTemplatesModule,
        CustomersModule,
        BillingModule,
        HealthModule,
        JobsModule,
    ],
    providers: [
        AppService,
        //{
        //    provide: APP_GUARD,
        //    useClass: AuthGuard,          // runs FIRST
        //},
        //{
        //    provide: APP_GUARD,
        //    useClass: PermissionsGuard,   // runs AFTER auth
        //},
    ],
})
export class AppModule { }
