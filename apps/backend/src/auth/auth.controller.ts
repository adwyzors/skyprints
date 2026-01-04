import { Controller, Get, Post, Req, Res, Body, Query } from '@nestjs/common';
import express from 'express';

import { AuthService } from './auth.service';
import { KeycloakService } from './keycloak/keycloak.service';

@Controller('auth')
export class AuthController {
    constructor(
        private readonly auth: AuthService,
        private readonly keycloak: KeycloakService,
    ) { }

    @Get('login')
    login(
        @Query('redirectTo') redirectTo = '/board',
        @Res() res: express.Response,
    ) {
        const state = Buffer.from(JSON.stringify({ redirectTo })).toString(
            'base64',
        );

        const loginUrl = this.keycloak.getLoginUrl(state);

        return res.redirect(loginUrl);
    }

    @Get('status')
    status(@Req() req: express.Request) {
        const sessionId = req.cookies?.['SESSION_ID'];

        if (!sessionId) {
            return {
                authenticated: false
                //loginUrl: this.keycloak.getLoginUrl(),
            };
        }

        return { authenticated: true };
    }

    @Post('callback')
    async callback(
        @Body('code') code: string,
        @Query('state') state: string,
        @Res({ passthrough: true }) res: express.Response,
    ) {
        const sessionId = await this.auth.login(code);

        res.cookie('SESSION_ID', sessionId, {
            httpOnly: true,
            sameSite: 'lax',
        });

        let redirectTo = '/board';

        if (state) {
            try {
                const parsed = JSON.parse(Buffer.from(state, 'base64').toString());

                const allowedPaths = ['/board', '/profile', '/settings'];

                if (allowedPaths.includes(parsed.redirectTo)) {
                    redirectTo = parsed.redirectTo;
                }
            } catch { }
        }

        res.redirect(redirectTo);
    }

    @Post('logout')
    logout(
        @Req() req: express.Request,
        @Res({ passthrough: true }) res: express.Response,
    ) {
        const sessionId = req.cookies?.['SESSION_ID'];
        if (sessionId) {
            this.auth.logout(sessionId);
        }

        res.clearCookie('SESSION_ID');
        return { success: true };
    }
}
