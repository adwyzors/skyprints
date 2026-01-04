import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { KeycloakService } from './keycloak/keycloak.service';
import { MemorySessionStore } from './session/memory-session.store';

@Module({
  controllers: [AuthController],
  providers: [AuthService, KeycloakService, MemorySessionStore],
  exports: [AuthService, MemorySessionStore],
})
export class AuthModule {}
