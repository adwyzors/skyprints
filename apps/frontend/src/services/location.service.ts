import { mapLocationSummaryDtosToLocations } from "@/domain/mapper/location.mapper";
import { Location } from "@/domain/model/location.model";
import { CreateLocationDto, LocationSummaryDto, LocationSummarySchema } from "@app/contracts";
import { apiRequest, apiRequestWithHeaders } from "./api.service";

export async function createLocation(dto: CreateLocationDto): Promise<void> {
    await apiRequest("/locations", {
        method: "POST",
        body: JSON.stringify(dto),
    });
}

export async function updateLocation(id: string, dto: Partial<CreateLocationDto>): Promise<void> {
    await apiRequest(`/locations/${id}`, {
        method: "PATCH",
        body: JSON.stringify(dto),
    });
}

export async function deleteLocation(id: string): Promise<void> {
    await apiRequest(`/locations/${id}`, {
        method: "DELETE",
    });
}

export async function getLocations(cookieHeader?: string): Promise<Location[]> {
    const res = await apiRequest<LocationSummaryDto[]>("/locations", {
        headers: {
            Cookie: cookieHeader || "",
        },
    });

    const dto = LocationSummarySchema.array().parse(res);

    return mapLocationSummaryDtosToLocations(dto);
}

export async function getLocationsWithHeaders(params: { page?: number; limit?: number, search?: string; isActive?: boolean } = {}): Promise<{ locations: Location[], total: number, page: number, limit: number, totalPages: number }> {
    const queryParams = new URLSearchParams();
    const requestedPage = params.page || 1;
    const requestedLimit = params.limit || 20;

    queryParams.append('page', requestedPage.toString());
    queryParams.append('limit', requestedLimit.toString());

    if (params.search) queryParams.append('search', params.search);
    if (typeof params.isActive === 'boolean') queryParams.append('isActive', String(params.isActive));

    const queryString = queryParams.toString();
    const url = queryString ? `/locations?${queryString}` : '/locations';

    const { data: res, headers } = await apiRequestWithHeaders<LocationSummaryDto[]>(url);
    // Default to empty array if res is null/undefined
    const parsed = LocationSummarySchema.array().parse(res || []);

    const total = parseInt(headers.get('x-total-count') || '0', 10);
    const page = parseInt(headers.get('x-page') || String(requestedPage), 10);
    const limit = parseInt(headers.get('x-limit') || String(requestedLimit), 10);
    const totalPages = parseInt(headers.get('x-total-pages') || '0', 10);

    return {
        locations: mapLocationSummaryDtosToLocations(parsed),
        total,
        page,
        limit,
        totalPages,
    };
}
