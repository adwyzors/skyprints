import { SessionData } from "./session.types";
import { SessionStore } from "./session.store";
export declare class MemorySessionStore implements SessionStore {
    private store;
    constructor();
    create(session: SessionData): string;
    get(sessionId: string): SessionData | null;
    delete(sessionId: string): void;
    private cleanup;
}
