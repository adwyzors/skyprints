// apps/backend/src/app.module.ts
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';

import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { UserModule } from './user/user.module';

import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthGuard } from './auth/guards/auth.guard';
import { PermissionsGuard } from './auth/guards/permissions.guard';
import { BillingModule } from './billing/billing.module';
import { RequestContextMiddleware } from './common/middleware/request-context.middleware';
import { CustomersModule } from './customers/customers.module';
import { JobsModule } from './jobs/jobs.module';
import { LocationsModule } from './locations/locations.module';
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
        LocationsModule,
        BillingModule,
        HealthModule,
        JobsModule,
    ],
    providers: [
        AppService,
        {
            provide: APP_GUARD,
            useClass: AuthGuard,          // runs FIRST
        },
        {
            provide: APP_GUARD,
            useClass: PermissionsGuard,   // runs AFTER auth
        },
    ],
})
export class AppModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer
            .apply(RequestContextMiddleware)
            .forRoutes('*');
    }
}
