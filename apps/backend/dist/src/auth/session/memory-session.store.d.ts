import { OnModuleDestroy } from '@nestjs/common';
import { SessionStore } from './session.store';
import { SessionData } from './session.types';
export declare class MemorySessionStore implements SessionStore, OnModuleDestroy {
    private readonly logger;
    private readonly store;
    private readonly cleanupInterval;
    constructor();
    create(session: SessionData): Promise<string>;
    get(sessionId: string): SessionData | null;
    delete(sessionId: string): void;
    onModuleDestroy(): void;
    private cleanup;
}
