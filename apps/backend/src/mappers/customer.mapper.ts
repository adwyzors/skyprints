import { CustomerSummaryDto } from '@app/contracts';
import { Customer } from '@prisma/client';

export function toCustomerSummary(
    customer: Customer,
): CustomerSummaryDto {
    return {
        id: customer.id,
        code: customer.code,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        isActive: customer.isActive,
        createdAt: customer.createdAt.toISOString(),
        updatedAt: customer.updatedAt.toISOString(),
    };
}
