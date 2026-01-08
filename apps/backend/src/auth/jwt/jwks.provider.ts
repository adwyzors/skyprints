import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import jwksClient from 'jwks-rsa';

export const JWKS_PROVIDER = 'JWKS_PROVIDER';

export const jwksProvider: Provider = {
    provide: JWKS_PROVIDER,
    inject: [ConfigService],
    useFactory: (config: ConfigService) => {
        const jwksUri = config.get<string>('JWKS_URI');
        if (!jwksUri) {
            throw new Error('JWKS_URI environment variable is not set');
        }

        return jwksClient({
            jwksUri,
            cache: true,
            cacheMaxEntries: 5,
            cacheMaxAge: 10 * 60 * 1000,
        });
    },
};
