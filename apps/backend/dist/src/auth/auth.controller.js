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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const express_1 = __importDefault(require("express"));
const auth_service_1 = require("./auth.service");
const public_decorator_1 = require("./decorators/public.decorator");
const keycloak_service_1 = require("./keycloak/keycloak.service");
const cookie_domain_util_1 = require("./utils/cookie-domain.util");
let AuthController = class AuthController {
    auth;
    keycloak;
    constructor(auth, keycloak) {
        this.auth = auth;
        this.keycloak = keycloak;
    }
    login(redirectTo = '/board', res) {
        const state = Buffer.from(JSON.stringify({ redirectTo })).toString('base64');
        const loginUrl = this.keycloak.getLoginUrl(state);
        return res.redirect(loginUrl);
    }
    status(req) {
        const sessionId = req.cookies?.['SESSION_ID'];
        return { authenticated: !!sessionId };
    }
    async me(req) {
        const sessionId = req.cookies?.['SESSION_ID'];
        if (!sessionId) {
            throw new common_1.UnauthorizedException();
        }
        const user = await this.auth.getSessionUser(sessionId);
        if (!user) {
            throw new common_1.UnauthorizedException();
        }
        return {
            id: user.id,
            email: user.email,
            permissions: user.permissions,
        };
    }
    async callback(code, state, req, res) {
        if (!code) {
            throw new common_1.UnauthorizedException('Missing authorization code');
        }
        const sessionId = await this.auth.login(code);
        res.cookie('SESSION_ID', sessionId, {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            domain: (0, cookie_domain_util_1.resolveCookieDomain)(req),
            maxAge: 1000 * 60 * 60 * 24,
            expires: new Date(Date.now() + 60 * 60 * 1000),
        });
        let redirectTo = '/board';
        if (state) {
            try {
                const parsed = JSON.parse(Buffer.from(state, 'base64').toString());
                redirectTo = parsed.redirectTo;
            }
            catch { }
        }
        return res.redirect(`${process.env.FRONT_END_BASE_URL}${redirectTo}`);
    }
    logout(req, res) {
        const sessionId = req.cookies?.['SESSION_ID'];
        if (sessionId) {
            this.auth.logout(sessionId);
        }
        res.clearCookie('SESSION_ID');
        return { success: true };
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, common_1.Get)('login'),
    (0, public_decorator_1.Public)(),
    __param(0, (0, common_1.Query)('redirectTo')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "login", null);
__decorate([
    (0, common_1.Get)('status'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "status", null);
__decorate([
    (0, common_1.Get)('me'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "me", null);
__decorate([
    (0, common_1.Get)('callback'),
    (0, public_decorator_1.Public)(),
    __param(0, (0, common_1.Query)('code')),
    __param(1, (0, common_1.Query)('state')),
    __param(2, (0, common_1.Req)()),
    __param(3, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "callback", null);
__decorate([
    (0, common_1.Post)('logout'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "logout", null);
exports.AuthController = AuthController = __decorate([
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [auth_service_1.AuthService,
        keycloak_service_1.KeycloakService])
], AuthController);
//# sourceMappingURL=auth.controller.js.map