import { KeycloakTokenResponse } from './keycloak.types';
export declare class KeycloakService {
    exchangeCode(code: string): Promise<KeycloakTokenResponse>;
    getLoginUrl(state?: string): string;
}
