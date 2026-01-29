import { Customer } from '@prisma/client';


export function toCustomerSummary(customer: Customer) {
    return {
        id: customer.id,
        code: customer.code,
        name: customer.name,

        email: customer.email ?? null,
        phone: customer.phone ?? null,
        address: customer.address ?? null,

        gstno: customer.gstno ?? null,
        tds: customer.tds,
        tax: customer.tax,

        isActive: customer.isActive,
        createdAt: customer.createdAt.toISOString(),
        updatedAt: customer.updatedAt.toISOString(),
    };
}

