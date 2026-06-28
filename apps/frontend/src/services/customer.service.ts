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


export async function getCustomers(cookieHeader?: string): Promise<Customer[]> {
    const res = await apiRequest<CustomerSummaryDto[]>("/customers", {
        headers: {
            Cookie: cookieHeader || "",
        },
    });

    const dto = CustomerSummarySchema.array().parse(res);

    return mapCustomerSummaryDtosToCustomers(dto);
}

export async function getCustomersWithHeaders(params: { page?: number; limit?: number, search?: string; } = {}): Promise<{ customers: Customer[], total: number, page: number, limit: number, totalPages: number }> {
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

export async function deleteCustomer(id: string): Promise<void> {
    await apiRequest(`/customers/${id}`, {
        method: "DELETE",
    });
}

export async function deleteCustomers(ids: string[]): Promise<void> {
    await apiRequest("/customers", {
        method: "DELETE",
        body: JSON.stringify({ ids }),
    });
}

export async function downloadCustomersExcel(): Promise<void> {
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;
    const response = await fetch(`${API_BASE_URL}/customers/export`, {
        method: 'GET',
        credentials: 'include',
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to download: ${text}`);
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `customers_${new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export async function uploadCustomersExcel(
    file: File,
): Promise<{ updated: number; skipped: number; errors: string[] }> {
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/customers/import`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
    });

    if (!response.ok) {
        const text = await response.text();
        let message = `Upload failed: ${text}`;
        try {
            const parsed = JSON.parse(text);
            if (parsed?.message) message = parsed.message;
        } catch {}
        throw new Error(message);
    }

    return response.json();
}
