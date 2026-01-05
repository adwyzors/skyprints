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
    me(req: express.Request): Promise<{
        id: string;
        email: string;
        permissions: string[];
    }>;
    callback(code: string, state: string, req: express.Request, res: express.Response): Promise<void>;
    logout(req: express.Request, res: express.Response): {
        success: boolean;
    };
}
