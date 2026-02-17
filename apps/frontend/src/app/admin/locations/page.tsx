'use client';

import { Permission } from '@/auth/permissions';
import { withAuth } from '@/auth/withAuth';
import { Location } from '@/domain/model/location.model';
import { getLocationsWithHeaders } from '@/services/location.service';
import debounce from 'lodash/debounce';
import { useCallback, useEffect, useState } from 'react';
import LocationClient from './LocationClient';

function LocationClientWrapper() {
    const [locationsData, setLocationsData] = useState<{
        locations: Location[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }>({
        locations: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
    });
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    const updateSearch = useCallback(
        debounce((value: string) => setDebouncedSearch(value), 500),
        [],
    );

    useEffect(() => {
        updateSearch(searchQuery);
        return () => updateSearch.cancel();
    }, [searchQuery, updateSearch]);

    const fetchLocations = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getLocationsWithHeaders({
                page: locationsData.page,
                limit: locationsData.limit,
                search: debouncedSearch || undefined,
                isActive: undefined, // Fetch all for admin
            });
            setLocationsData(data);
        } catch (err) {
            console.error('Failed to fetch locations', err);
        } finally {
            setLoading(false);
        }
    }, [locationsData.page, locationsData.limit, debouncedSearch]);

    useEffect(() => {
        fetchLocations();
    }, [fetchLocations]);

    const handlePageChange = (newPage: number) => {
        setLocationsData((prev) => ({ ...prev, page: newPage }));
    };

    const handlePageSizeChange = (newSize: number) => {
        setLocationsData((prev) => ({ ...prev, limit: newSize, page: 1 }));
    };

    return (
        <LocationClient
            locationsData={locationsData}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            refetch={fetchLocations}
            loading={loading}
        />
    );
}

export default withAuth(LocationClientWrapper, { permission: Permission.LOCATIONS_VIEW });
