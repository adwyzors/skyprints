"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var MemorySessionStore_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemorySessionStore = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
let MemorySessionStore = MemorySessionStore_1 = class MemorySessionStore {
    logger = new common_1.Logger(MemorySessionStore_1.name);
    store = new Map();
    cleanupInterval;
    constructor() {
        this.logger.log('MemorySessionStore instance created');
        this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
        this.cleanupInterval.unref();
    }
    async create(session) {
        if (session.expiresAt <= Date.now()) {
            throw new Error('Session expiry must be in the future');
        }
        const sessionId = (0, crypto_1.randomUUID)();
        this.store.set(sessionId, session);
        this.logger.debug(`Session created: ${sessionId}`);
        return sessionId;
    }
    get(sessionId) {
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
    delete(sessionId) {
        this.logger.debug(`Session deleted: ${sessionId}`);
        this.store.delete(sessionId);
    }
    onModuleDestroy() {
        clearInterval(this.cleanupInterval);
    }
    cleanup() {
        const now = Date.now();
        for (const [id, session] of this.store.entries()) {
            if (session.expiresAt <= now) {
                this.store.delete(id);
            }
        }
    }
};
exports.MemorySessionStore = MemorySessionStore;
exports.MemorySessionStore = MemorySessionStore = MemorySessionStore_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], MemorySessionStore);
//# sourceMappingURL=memory-session.store.js.map