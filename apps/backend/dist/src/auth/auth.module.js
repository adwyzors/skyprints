"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthModule = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const auth_controller_1 = require("./auth.controller");
const auth_service_1 = require("./auth.service");
const public_auth_guard_1 = require("./guards/public-auth.guard");
const session_auth_guard_1 = require("./guards/session-auth.guard");
const token_auth_guard_1 = require("./guards/token-auth.guard");
const jwks_provider_1 = require("./jwt/jwks.provider");
const keycloak_service_1 = require("./keycloak/keycloak.service");
const memory_session_store_1 = require("./session/memory-session.store");
const session_constant_1 = require("./session/session.constant");
let AuthModule = class AuthModule {
};
exports.AuthModule = AuthModule;
exports.AuthModule = AuthModule = __decorate([
    (0, common_1.Module)({
        imports: [
            jwt_1.JwtModule.registerAsync({
                useFactory: () => ({
                    publicKey: process.env.JWT_PUBLIC_KEY,
                    signOptions: {
                        algorithm: 'RS256',
                        issuer: process.env.TOKEN_ISSUER,
                        audience: process.env.TOKEN_AUDIENCE,
                    },
                }),
            })
        ],
        controllers: [auth_controller_1.AuthController],
        providers: [
            auth_service_1.AuthService,
            keycloak_service_1.KeycloakService,
            memory_session_store_1.MemorySessionStore,
            {
                provide: session_constant_1.SESSION_STORE,
                useClass: memory_session_store_1.MemorySessionStore,
            },
            public_auth_guard_1.PublicAuthGuard,
            session_auth_guard_1.SessionAuthGuard,
            token_auth_guard_1.TokenAuthGuard,
            jwks_provider_1.jwksProvider,
        ],
        exports: [
            auth_service_1.AuthService,
            memory_session_store_1.MemorySessionStore,
            public_auth_guard_1.PublicAuthGuard,
            session_auth_guard_1.SessionAuthGuard,
            token_auth_guard_1.TokenAuthGuard,
            jwks_provider_1.jwksProvider
        ],
    })
], AuthModule);
//# sourceMappingURL=auth.module.js.map