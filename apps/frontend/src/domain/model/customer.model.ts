export interface Customer {
    id: string;
    code: string;
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    gstno?: string;
    tdsno?: number;
    tax?: boolean;
    tds?: boolean;
    isActive: boolean;
    creditLimit: number;
    outstandingAmount: number;
    createdAt: Date;
    updatedAt: Date;
}
