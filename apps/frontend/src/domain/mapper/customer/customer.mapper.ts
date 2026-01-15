// domain/mapper/customer/customer.mapper.ts
import { Customer } from "@/domain/model/customer.model";
import { CustomerSummaryDto } from "@app/contracts";

export const mapCustomerSummaryDtosToCustomers = (
    dtos: CustomerSummaryDto[]
): Customer[] =>
    dtos.map((dto) => ({
        id: dto.id,
        code: dto.code,
        name: dto.name,
        email: dto.email ?? undefined,
        phone: dto.phone ?? undefined,
        address: dto.address ?? undefined,
        isActive: dto.isActive,
        createdAt: new Date(dto.createdAt),
        updatedAt: new Date(dto.updatedAt),
    }));
