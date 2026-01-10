// auth/guards/auth.guard.ts
import {
    CanActivate,
    ExecutionContext,
    Injectable
} from '@nestjs/common';
import { PublicAuthGuard } from './public-auth.guard';
import { SessionAuthGuard } from './session-auth.guard';
import { TokenAuthGuard } from './token-auth.guard';

@Injectable()
export class AuthGuard implements CanActivate {
    constructor(
        private readonly publicGuard: PublicAuthGuard,
        private readonly sessionGuard: SessionAuthGuard,
        private readonly tokenGuard: TokenAuthGuard,
    ) { }

    async canActivate(ctx: ExecutionContext): Promise<boolean> {
        return true;
        //// 1️⃣ Public routes
        //if (this.publicGuard.canActivate(ctx)) {
        //    return true;
        //}

        //// 2️⃣ Browser sessions
        //if (await this.sessionGuard.canActivate(ctx)) {
        //    return true;
        //}

        //// 3️⃣ Backend tokens
        //if (await this.tokenGuard.canActivate(ctx)) {
        //    return true;
        //}

        //// 4️⃣ Nothing matched
        //throw new UnauthorizedException('Authentication required');
    }
}
