// auth/session/memory-session.store.ts
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SessionStore } from './session.store';
import { SessionData } from './session.types';

@Injectable()
export class MemorySessionStore
    implements SessionStore, OnModuleDestroy {
    private readonly logger = new Logger(MemorySessionStore.name);
    private readonly store = new Map<string, SessionData>();
    private readonly cleanupInterval: NodeJS.Timeout;

    constructor() {
        this.logger.log('MemorySessionStore instance created');

        this.cleanupInterval = setInterval(
            () => this.cleanup(),
            5 * 60 * 1000,
        );

        this.cleanupInterval.unref();
    }

    async create(session: SessionData): Promise<string> {
        if (session.expiresAt <= Date.now()) {
            throw new Error('Session expiry must be in the future');
        }

        const sessionId = randomUUID();
        this.store.set(sessionId, session);

        this.logger.debug(`Session created: ${sessionId}`);
        return sessionId;
    }

    get(sessionId: string): SessionData | null {
        const session = this.store.get(sessionId);

        if (!session) {
            this.logger.debug(`Session miss: ${sessionId}`);
            return null;
        }

        if (Date.now() > session.expiresAt) {
            this.logger.debug(`Session expired: ${sessionId}`);
            this.store.delete(sessionId);
            return null;
        }

        return session;
    }

    delete(sessionId: string): void {
        this.logger.debug(`Session deleted: ${sessionId}`);
        this.store.delete(sessionId);
    }

    onModuleDestroy() {
        clearInterval(this.cleanupInterval);
    }

    private cleanup() {
        const now = Date.now();
        for (const [id, session] of this.store.entries()) {
            if (session.expiresAt <= now) {
                this.store.delete(id);
            }
        }
    }
}
