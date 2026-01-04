"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemorySessionStore = void 0;
const crypto_1 = require("crypto");
class MemorySessionStore {
    store = new Map();
    constructor() {
        setInterval(() => this.cleanup(), 5 * 60 * 1000).unref();
    }
    create(session) {
        const sessionId = (0, crypto_1.randomUUID)();
        this.store.set(sessionId, session);
        return sessionId;
    }
    get(sessionId) {
        const session = this.store.get(sessionId);
        if (!session)
            return null;
        if (Date.now() > session.expiresAt) {
            this.store.delete(sessionId);
            return null;
        }
        return session;
    }
    delete(sessionId) {
        this.store.delete(sessionId);
    }
    cleanup() {
        const now = Date.now();
        for (const [id, session] of this.store.entries()) {
            if (session.expiresAt < now) {
                this.store.delete(id);
            }
        }
    }
}
exports.MemorySessionStore = MemorySessionStore;
//# sourceMappingURL=memory-session.store.js.map