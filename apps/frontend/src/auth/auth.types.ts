export interface AuthUser {
    id: string;
    alternateEmail?: string;
    permissions: string[]; // B7: was roles — renamed to match backend response key
    user: {
        id: string;
        email: string;
        name: string;
        role: string;
        isActive: boolean;
        createdAt: string;
        updatedAt: string;
        location?: any;
        preferences?: any;
    };
}
