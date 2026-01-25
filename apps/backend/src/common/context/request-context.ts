export interface RequestContext {
    correlationId: string;
    user?: {
        id: string;
        email: string;
        permissions: string[];
        roles: string[];
    };
}
