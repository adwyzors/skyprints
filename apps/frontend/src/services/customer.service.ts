// services/customer.service.ts
import { mapCustomerSummaryDtosToCustomers } from "@/domain/mapper/customer/customer.mapper";
import { Customer } from "@/domain/model/customer.model";
import { CreateCustomerDto, CustomerSummaryDto, CustomerSummarySchema } from "@app/contracts";
import { apiRequest, apiRequestWithHeaders } from "./api.service";

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

export async function getCustomers(params: { page?: number; limit?: number, search?: string; } = {}): Promise<{ customers: Customer[], total: number, page: number, limit: number, totalPages: number }> {
    const queryParams = new URLSearchParams();
    const requestedPage = params.page || 1;
    const requestedLimit = params.limit || 20;

    queryParams.append('page', requestedPage.toString());
    queryParams.append('limit', requestedLimit.toString());

    if (params.search) queryParams.append('search', params.search);

    const queryString = queryParams.toString();
    const url = queryString ? `/customers?${queryString}` : '/customers';

    const { data: res, headers } = await apiRequestWithHeaders<CustomerSummaryDto[]>(url);
    const parsed = CustomerSummarySchema.array().parse(res || []);

    const total = parseInt(headers.get('x-total-count') || '0', 10);
    const page = parseInt(headers.get('x-page') || String(requestedPage), 10);
    const limit = parseInt(headers.get('x-limit') || String(requestedLimit), 10);
    const totalPages = parseInt(headers.get('x-total-pages') || '0', 10);

    return {
        customers: mapCustomerSummaryDtosToCustomers(parsed),
        total,
        page,
        limit,
        totalPages,
    };
}
