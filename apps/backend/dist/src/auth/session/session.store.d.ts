import { SessionData } from "./session.types";
export interface SessionStore {
    create(session: SessionData): string;
    get(sessionId: string): SessionData | null;
    delete(sessionId: string): void;
}
