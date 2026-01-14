// auth/session/session.store.ts
import { SessionData } from './session.types';

export interface SessionStore {
    create(session: SessionData): Promise<string>;
    get(sessionId: string): SessionData | null;
    delete(sessionId: string): void;
}
