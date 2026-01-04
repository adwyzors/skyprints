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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const keycloak_service_1 = require("./keycloak/keycloak.service");
const memory_session_store_1 = require("./session/memory-session.store");
let AuthService = class AuthService {
    keycloak;
    sessionStore;
    constructor(keycloak, sessionStore) {
        this.keycloak = keycloak;
        this.sessionStore = sessionStore;
    }
    async login(code) {
        const tokens = await this.keycloak.exchangeCode(code);
        return this.sessionStore.create({
            userId: tokens.id_token,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            expiresAt: Date.now() + tokens.expires_in * 1000,
        });
    }
    logout(sessionId) {
        this.sessionStore.delete(sessionId);
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [keycloak_service_1.KeycloakService,
        memory_session_store_1.MemorySessionStore])
], AuthService);
//# sourceMappingURL=auth.service.js.map