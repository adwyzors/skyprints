import { Customer } from '@prisma/client';
import { CustomerSummaryDto } from '../../../packages/contracts/dist/customer.read.contract';

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
