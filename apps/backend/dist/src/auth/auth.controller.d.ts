import express from 'express';
import { AuthService } from './auth.service';
import { KeycloakService } from './keycloak/keycloak.service';
export declare class AuthController {
    private readonly auth;
    private readonly keycloak;
    constructor(auth: AuthService, keycloak: KeycloakService);
    login(redirectTo: string | undefined, res: express.Response): void;
    status(req: express.Request): {
        authenticated: boolean;
    };
    callback(code: string, state: string, res: express.Response): Promise<void>;
    logout(req: express.Request, res: express.Response): {
        success: boolean;
    };
}
