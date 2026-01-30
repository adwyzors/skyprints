export interface Customer {
    id: string;
    code: string;
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    gstno?: string;
    tax?: boolean;
    tds?: boolean;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
