import { OnModuleDestroy } from '@nestjs/common';
import { SessionData } from './session.types';
import { SessionStore } from './session.store';
export declare class MemorySessionStore implements SessionStore, OnModuleDestroy {
    private readonly store;
    private readonly cleanupInterval;
    constructor();
    create(session: SessionData): string;
    get(sessionId: string): SessionData | null;
    delete(sessionId: string): void;
    onModuleDestroy(): void;
    private cleanup;
}
