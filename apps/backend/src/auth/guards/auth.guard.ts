import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { PublicAuthGuard } from "./public-auth.guard";

@Injectable()
export class AuthGuard implements CanActivate {
    constructor(
        private readonly publicGuard: PublicAuthGuard,
        private readonly jwtGuard: JwtAuthGuard,
    ) { }

    async canActivate(ctx: ExecutionContext): Promise<boolean> {
        if (this.publicGuard.canActivate(ctx)) {
            return true;
        }

        return this.jwtGuard.canActivate(ctx);
    }
}
