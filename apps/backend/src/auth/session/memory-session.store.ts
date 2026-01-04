// auth/session/memory-session.store.ts
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SessionData } from './session.types';
import { SessionStore } from './session.store';

@Injectable()
export class MemorySessionStore
  implements SessionStore, OnModuleDestroy
{
  private readonly store = new Map<string, SessionData>();
  private readonly cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Cleanup expired sessions every 5 minutes
    this.cleanupInterval = setInterval(
      () => this.cleanup(),
      5 * 60 * 1000,
    );

    this.cleanupInterval.unref();
  }

  create(session: SessionData): string {
    if (session.expiresAt <= Date.now()) {
      throw new Error('Session expiry must be in the future');
    }

    const sessionId = randomUUID();
    this.store.set(sessionId, session);
    return sessionId;
  }

  get(sessionId: string): SessionData | null {
    const session = this.store.get(sessionId);
    if (!session) return null;

    if (Date.now() > session.expiresAt) {
      this.store.delete(sessionId);
      return null;
    }

    return session;
  }

  delete(sessionId: string): void {
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
