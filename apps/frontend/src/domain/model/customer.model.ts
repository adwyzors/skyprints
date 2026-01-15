export interface Customer {
    id: string;
    code: string;
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
