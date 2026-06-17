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
    const [currentPage, setCurrentPage] = useState(1);
    const [currentLimit, setCurrentLimit] = useState(10);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const updateSearch = useCallback(
        debounce((value: string) => {
            setDebouncedSearch(value);
            setCurrentPage(1);
        }, 500),
        [],
    );

    useEffect(() => {
        updateSearch(searchQuery);
        return () => updateSearch.cancel();
    }, [searchQuery, updateSearch]);

    useEffect(() => {
        let cancelled = false;
        async function fetchLocations() {
            setLoading(true);
            try {
                const data = await getLocationsWithHeaders({
                    page: currentPage,
                    limit: currentLimit,
                    search: debouncedSearch || undefined,
                    isActive: undefined,
                });
                if (!cancelled) setLocationsData(data);
            } catch (err) {
                console.error('Failed to fetch locations', err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        fetchLocations();
        return () => { cancelled = true; };
    }, [currentPage, currentLimit, debouncedSearch, refreshTrigger]);

    const handlePageChange = (newPage: number) => setCurrentPage(newPage);

    const handlePageSizeChange = (newSize: number) => {
        setCurrentLimit(newSize);
        setCurrentPage(1);
    };

    const refetch = useCallback(() => setRefreshTrigger(prev => prev + 1), []);

    return (
        <LocationClient
            locationsData={locationsData}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            refetch={refetch}
            loading={loading}
        />
    );
}

export default withAuth(LocationClientWrapper, { permission: Permission.LOCATIONS_VIEW });
