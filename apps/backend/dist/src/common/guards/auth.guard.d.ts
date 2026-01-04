import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MemorySessionStore } from 'src/auth/session/memory-session.store';
export declare class AuthGuard implements CanActivate {
    private reflector;
    private sessionStore;
    constructor(reflector: Reflector, sessionStore: MemorySessionStore);
    canActivate(ctx: ExecutionContext): boolean;
}
