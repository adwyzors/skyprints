import { SessionData } from "./session.types";

// auth/session/session.store.ts
export interface SessionStore {
  create(session: SessionData): string;
  get(sessionId: string): SessionData | null;
  delete(sessionId: string): void;
}
