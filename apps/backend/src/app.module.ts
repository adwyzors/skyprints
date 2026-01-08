// apps/backend/src/app.module.ts
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { UserModule } from './user/user.module';

import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from 'prisma/prisma.module';
import { PermissionsGuard } from 'src/auth/guards/permissions.guard';
import { AuthGuard } from './auth/guards/auth.guard';
import { OrdersModule } from './orders/orders.module';
import { OutboxModule } from './outbox/outbox.module';
import { ProcessesModule } from './processes/processes.module';
import { RunTemplatesModule } from './run-templates/run-templates.module';
import { RunsModule } from './runs/runs.module';
import { WorkflowModule } from './workflow/workflow.module';

@Module({
    imports: [ConfigModule.forRoot({
        isGlobal: true, // VERY IMPORTANT
        envFilePath: 'apps/backend/.env',
    }), PrismaModule,
        OutboxModule,
        WorkflowModule,
        OrdersModule,
        RunsModule,
        AuthModule,
        UserModule,
        ProcessesModule,
        RunTemplatesModule,
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
