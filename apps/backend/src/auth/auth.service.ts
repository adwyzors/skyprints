import { Injectable, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import {
    cookieOptions
} from './utils/cookie-domain.util';

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);

    setAuthCookies(res: Response, tokens: any, req: Request) {
        this.setAccessCookie(res, tokens.access_token, req);

        res.cookie(
            'REFRESH_TOKEN',
            tokens.refresh_token,
            cookieOptions(req, 7 * 24 * 60 * 60),
        );

        this.logger.log('Auth cookies set');
    }

    setAccessCookie(res: Response, token: string, req: Request) {
        res.cookie(
            'ACCESS_TOKEN',
            token,
            cookieOptions(req, 10 * 60),
        );
    }

    clearCookies(res: Response, req: Request) {
        //const domain = resolveCookieDomain(req);
        const options = cookieOptions(req, 0);

        res.clearCookie('ACCESS_TOKEN', options);
        res.clearCookie('REFRESH_TOKEN', options);
        this.logger.log('Auth cookies cleared');
    }
}
