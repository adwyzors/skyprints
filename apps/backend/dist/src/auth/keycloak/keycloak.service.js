"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KeycloakService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = __importDefault(require("axios"));
let KeycloakService = class KeycloakService {
    async exchangeCode(code) {
        const tokenUrl = `${process.env.KEYCLOAK_BASE_URL}/realms/${process.env.KEYCLOAK_REALM}` +
            `/protocol/openid-connect/token`;
        const params = new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: process.env.KEYCLOAK_CLIENT_ID,
            client_secret: process.env.KEYCLOAK_CLIENT_SECRET,
            code,
            redirect_uri: `${process.env.APP_BASE_URL}/auth/callback`,
        });
        const response = await axios_1.default.post(tokenUrl, params, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });
        return response.data;
    }
    getLoginUrl(state) {
        const url = new URL(`${process.env.KEYCLOAK_BASE_URL}/realms/${process.env.KEYCLOAK_REALM}/protocol/openid-connect/auth`);
        url.searchParams.set('client_id', process.env.KEYCLOAK_CLIENT_ID);
        url.searchParams.set('response_type', 'code');
        url.searchParams.set('redirect_uri', `${process.env.APP_BASE_URL}/auth/callback`);
        url.searchParams.set('scope', 'openid profile email');
        if (state) {
            url.searchParams.set('state', state);
        }
        return url.toString();
    }
    async getUserInfo(accessToken) {
        const res = await fetch(`${process.env.KEYCLOAK_BASE_URL}/realms/${process.env.KEYCLOAK_REALM}/protocol/openid-connect/userinfo`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });
        const text = await res.text();
        if (!res.ok) {
            throw new Error(`UserInfo failed: ${res.status} ${res.statusText} - ${text}`);
        }
        if (!text) {
            throw new Error('UserInfo returned empty response');
        }
        return JSON.parse(text);
    }
};
exports.KeycloakService = KeycloakService;
exports.KeycloakService = KeycloakService = __decorate([
    (0, common_1.Injectable)()
], KeycloakService);
//# sourceMappingURL=keycloak.service.js.map