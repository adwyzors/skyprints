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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_decode_1 = require("jwt-decode");
const keycloak_service_1 = require("./keycloak/keycloak.service");
const session_constant_1 = require("./session/session.constant");
let AuthService = class AuthService {
    keycloak;
    sessionStore;
    constructor(keycloak, sessionStore) {
        this.keycloak = keycloak;
        this.sessionStore = sessionStore;
    }
    async login(code) {
        const tokens = await this.keycloak.exchangeCode(code);
        const userInfo = (0, jwt_decode_1.jwtDecode)(tokens.access_token);
        const permissions = this.mapPermissions(userInfo);
        return this.sessionStore.create({
            user: {
                id: userInfo.sub,
                email: userInfo.email,
                permissions,
            },
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            expiresAt: Date.now() + tokens.expires_in * 1000,
        });
    }
    async getSessionUser(sessionId) {
        const session = this.sessionStore.get(sessionId);
        if (!session || session.expiresAt < Date.now()) {
            if (session)
                this.sessionStore.delete(sessionId);
            return null;
        }
        return session.user;
    }
    logout(sessionId) {
        this.sessionStore.delete(sessionId);
    }
    mapPermissions(userInfo) {
        return Array.from(new Set(userInfo.permissions ?? []));
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(session_constant_1.SESSION_STORE)),
    __metadata("design:paramtypes", [keycloak_service_1.KeycloakService, Object])
], AuthService);
//# sourceMappingURL=auth.service.js.map