// services/orders.service.ts
import { mapCustomerSummaryDtosToCustomers } from "@/domain/mapper/customer/customer.mapper";
import { Customer } from "@/domain/model/customer.model";
import { CustomerSummarySchema, CustomerSummaryDto } from "@app/contracts";
import { apiRequest } from "./api.service";

export async function getCustomers(): Promise<Customer[]> {
    const res = await apiRequest<CustomerSummaryDto[]>("/customers");

    const dto = CustomerSummarySchema.array().parse(res);

    return mapCustomerSummaryDtosToCustomers(dto);
}
