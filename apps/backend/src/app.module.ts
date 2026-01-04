// apps/backend/src/app.module.ts
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { HealthModule } from './health/health.module';

import { AuthGuard } from 'src/common/guards/auth.guard';
import { PermissionsGuard } from 'src/common/guards/permissions.guard';

@Module({
  imports: [AuthModule, UserModule, HealthModule],
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
export class AppModule {}
