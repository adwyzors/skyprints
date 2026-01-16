// apps/backend/src/app.module.ts
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { UserModule } from './user/user.module';

import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthGuard } from './auth/guards/auth.guard';
import { PermissionsGuard } from './auth/guards/permissions.guard';
import { SessionModule } from './auth/session/session.module';
import { CustomersModule } from './customers/customers.module';
import { OrdersModule } from './orders/orders.module';
import { OutboxModule } from './outbox/outbox.module';
import { ProcessesModule } from './processes/processes.module';
import { RunTemplatesModule } from './run-templates/run-templates.module';
import { RunsModule } from './runs/runs.module';
import { WorkflowModule } from './workflow/workflow.module';
import { BillingModule } from './billing/billing.module';

@Module({
    imports: [ConfigModule.forRoot({
        isGlobal: true, // VERY IMPORTANT
        envFilePath: [
            '.env',
            `apps/backend/.env.${process.env.NODE_ENV || 'local'}`,
        ]
    }), PrismaModule,
        OutboxModule,
        WorkflowModule,
        OrdersModule,
        RunsModule,
        SessionModule,
        AuthModule,
        UserModule,
        ProcessesModule,
        RunTemplatesModule,
        CustomersModule,
        BillingModule,
        HealthModule,],
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
export class AppModule { }
