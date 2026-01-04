"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KeycloakService = void 0;
const common_1 = require("@nestjs/common");
let KeycloakService = class KeycloakService {
    async exchangeCode(code) {
        return {
            access_token: 'access',
            refresh_token: 'refresh',
            id_token: 'id',
            expires_in: 3600,
        };
    }
    getLoginUrl(state) {
        const url = new URL(`${process.env.KEYCLOAK_BASE_URL}/realms/${process.env.KEYCLOAK_REALM}/protocol/openid-connect/auth`);
        url.searchParams.set('client_id', process.env.KEYCLOAK_CLIENT_ID);
        url.searchParams.set('response_type', 'code');
        url.searchParams.set('scope', 'openid email profile');
        url.searchParams.set('redirect_uri', `${process.env.APP_BASE_URL}/auth/callback`);
        if (state) {
            url.searchParams.set('state', state);
        }
        return url.toString();
    }
};
exports.KeycloakService = KeycloakService;
exports.KeycloakService = KeycloakService = __decorate([
    (0, common_1.Injectable)()
], KeycloakService);
//# sourceMappingURL=keycloak.service.js.map