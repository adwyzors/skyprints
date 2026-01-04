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
exports.AuthGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const public_decorator_1 = require("../../auth/decorators/public.decorator");
const memory_session_store_1 = require("../../auth/session/memory-session.store");
let AuthGuard = class AuthGuard {
    reflector;
    sessionStore;
    constructor(reflector, sessionStore) {
        this.reflector = reflector;
        this.sessionStore = sessionStore;
    }
    canActivate(ctx) {
        const isPublic = this.reflector.getAllAndOverride(public_decorator_1.IS_PUBLIC_KEY, [ctx.getHandler(), ctx.getClass()]);
        if (isPublic)
            return true;
        const req = ctx.switchToHttp().getRequest();
        const sessionId = req.cookies?.['SESSION_ID'];
        if (!sessionId) {
            throw new common_1.UnauthorizedException('Missing session');
        }
        const session = this.sessionStore.get(sessionId);
        if (!session) {
            throw new common_1.UnauthorizedException('Invalid session');
        }
        req.user = session;
        return true;
    }
};
exports.AuthGuard = AuthGuard;
exports.AuthGuard = AuthGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector,
        memory_session_store_1.MemorySessionStore])
], AuthGuard);
//# sourceMappingURL=auth.guard.js.map