// auth/session/memory-session.store.ts
import { randomUUID } from "crypto";
import { SessionData } from "./session.types";
import { SessionStore } from "./session.store";

export class MemorySessionStore implements SessionStore {
  private store = new Map<string, SessionData>();

  constructor() {
    // Cleanup expired sessions every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000).unref();
  }

  create(session: SessionData): string {
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

  private cleanup() {
    const now = Date.now();
    for (const [id, session] of this.store.entries()) {
      if (session.expiresAt < now) {
        this.store.delete(id);
      }
    }
  }
}
