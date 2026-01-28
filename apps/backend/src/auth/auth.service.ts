import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from 'apps/backend/prisma/prisma.service';
import type { Request, Response } from 'express';
import { ContextLogger } from '../common/logger/context.logger';
import {
    cookieOptions
} from './utils/cookie-domain.util';

@Injectable()
export class AuthService {
    private readonly logger = new ContextLogger(AuthService.name);


    constructor(
        private readonly prisma: PrismaService,
    ) { }

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

    async getMe(authUser: any) {
        const user = await this.prisma.user.findFirst({
            where: {
                id: authUser.id,
                isActive: true,
                deletedAt: null,
            },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
                location: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                        type: true,
                    },
                },
            },
        });

        if (!user) {
            throw new ForbiddenException(
                'User is inactive or deleted',
            );
        }

        return {
            id: authUser.id,
            alternateEmail: authUser.email,
            roles: authUser.permissions ?? [],
            user,
        };
    }

}
