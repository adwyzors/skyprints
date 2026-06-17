'use client';

import { Permission } from '@/auth/permissions';
import { withAuth } from '@/auth/withAuth';
import { Customer } from '@/domain/model/customer.model';
import { getCustomersWithHeaders } from '@/services/customer.service';
import debounce from 'lodash/debounce';
import { useCallback, useEffect, useState } from 'react';
import CustomerClient from './CustomerClient';

function CustomerClientWrapper() {
    const [customersData, setCustomersData] = useState<{
        customers: Customer[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }>({
        customers: [],
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
        async function fetchCustomers() {
            setLoading(true);
            try {
                const data = await getCustomersWithHeaders({
                    page: currentPage,
                    limit: currentLimit,
                    search: debouncedSearch || undefined,
                });
                if (!cancelled) setCustomersData(data);
            } catch (err) {
                console.error('Failed to fetch customers', err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        fetchCustomers();
        return () => { cancelled = true; };
    }, [currentPage, currentLimit, debouncedSearch, refreshTrigger]);

    const handlePageChange = (newPage: number) => setCurrentPage(newPage);

    const handlePageSizeChange = (newSize: number) => {
        setCurrentLimit(newSize);
        setCurrentPage(1);
    };

    const refetch = useCallback(() => setRefreshTrigger(prev => prev + 1), []);

    return (
        <CustomerClient
            customersData={customersData}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            refetch={refetch}
            loading={loading}
        />
    );
}

export default withAuth(CustomerClientWrapper, { permission: Permission.CUSTOMERS_VIEW });
