// services/customer.service.ts
import { mapCustomerSummaryDtosToCustomers } from "@/domain/mapper/customer/customer.mapper";
import { Customer } from "@/domain/model/customer.model";
import { CreateCustomerDto, CustomerSummaryDto, CustomerSummarySchema } from "@app/contracts";
import { apiRequest } from "./api.service";

export async function createCustomer(dto: CreateCustomerDto): Promise<void> {
    await apiRequest("/customers", {
        method: "POST",
        body: JSON.stringify(dto),
    });
}

export async function updateCustomer(id: string, dto: Partial<CreateCustomerDto>): Promise<void> {
    await apiRequest(`/customers/${id}`, {
        method: "PATCH",
        body: JSON.stringify(dto),
    });
}

export async function getCustomers(cookieHeader?: string): Promise<Customer[]> {
    const res = await apiRequest<CustomerSummaryDto[]>("/customers", {
        headers: {
            Cookie: cookieHeader || "",
        },
    });

    const dto = CustomerSummarySchema.array().parse(res);

    return mapCustomerSummaryDtosToCustomers(dto);
}
