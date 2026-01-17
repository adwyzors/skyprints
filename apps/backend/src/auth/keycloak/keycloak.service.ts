import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
@Injectable()
export class KeycloakService {
    private readonly logger = new Logger(KeycloakService.name);

    async exchangeCode(code: string) {
        this.logger.log('Exchanging authorization code for tokens');

        try {
            const res = await axios.post(
                process.env.KEYCLOAK_TOKEN_URL!,
                new URLSearchParams({
                    grant_type: 'authorization_code',
                    client_id: process.env.KEYCLOAK_CLIENT_ID!,
                    client_secret: process.env.KEYCLOAK_CLIENT_SECRET!,
                    code,
                    redirect_uri: `${process.env.APP_BASE_URL}/auth/callback`,
                }),
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                },
            );

            this.logger.debug('Token exchange succeeded');
            return res.data;
        } catch (err: any) {
            this.logger.error(
                'Token exchange with Keycloak failed',
                err?.response?.data ?? err.message,
            );
            throw err;
        }
    }

    async refresh(refreshToken: string) {
        this.logger.log('Refreshing access token via Keycloak');

        try {
            const res = await axios.post(
                process.env.KEYCLOAK_TOKEN_URL!,
                new URLSearchParams({
                    grant_type: 'refresh_token',
                    client_id: process.env.KEYCLOAK_CLIENT_ID!,
                    client_secret: process.env.KEYCLOAK_CLIENT_SECRET!,
                    refresh_token: refreshToken,
                }),
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                },
            );

            this.logger.debug('Token refresh succeeded');
            return res.data;
        } catch (err: any) {
            this.logger.error(
                'Token refresh failed',
                err?.response?.data ?? err.message,
            );
            throw err;
        }
    }

    getLoginUrl(state?: string) {
        this.logger.debug('Generating Keycloak authorization URL');

        const url = new URL(process.env.KEYCLOAK_AUTH_URL!);

        url.searchParams.set('client_id', process.env.KEYCLOAK_CLIENT_ID!);
        url.searchParams.set('response_type', 'code');
        url.searchParams.set('scope', 'openid profile email');
        url.searchParams.set(
            'redirect_uri',
            `${process.env.APP_BASE_URL}/auth/callback`,
        );

        if (state) {
            url.searchParams.set('state', state);
        }

        return url.toString();
    }

    async keycloakLogout(refreshToken: string) {
        this.logger.log('Calling Keycloak end-session endpoint');

        try {
            await axios.post(
                process.env.KEYCLOAK_LOGOUT_URL!,
                new URLSearchParams({
                    client_id: process.env.KEYCLOAK_CLIENT_ID!,
                    client_secret: process.env.KEYCLOAK_CLIENT_SECRET!,
                    refresh_token: refreshToken,
                }),
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                },
            );

            this.logger.debug('Keycloak session successfully terminated');
        } catch (err: any) {
            this.logger.error(
                'Keycloak logout failed',
                err?.response?.data ?? err.message,
            );
            throw err;
        }
    }
}
