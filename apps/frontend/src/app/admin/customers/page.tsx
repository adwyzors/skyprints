'use client';

import { Customer } from '@/domain/model/customer.model';
import { getCustomers } from '@/services/customer.service';
import debounce from 'lodash/debounce';
import { useCallback, useEffect, useState } from 'react';
import CustomerClient from './CustomerClient';

export default function CustomerClientWrapper() {
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
    limit: 10, // default page size
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search input
  const updateSearch = useCallback(
    debounce((value: string) => setDebouncedSearch(value), 500),
    [],
  );

  useEffect(() => {
    updateSearch(searchQuery);
    return () => updateSearch.cancel();
  }, [searchQuery, updateSearch]);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getCustomers({
        page: customersData.page,
        limit: customersData.limit,
        search: debouncedSearch || undefined,
      });
      setCustomersData(data);
    } catch (err) {
      console.error('Failed to fetch customers', err);
    } finally {
      setLoading(false);
    }
  }, [customersData.page, customersData.limit, debouncedSearch]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const handlePageChange = (newPage: number) => {
    setCustomersData((prev) => ({ ...prev, page: newPage }));
  };

  const handlePageSizeChange = (newSize: number) => {
    setCustomersData((prev) => ({ ...prev, limit: newSize, page: 1 }));
  };

  if (loading) return <p>Loading...</p>;

  return (
    <CustomerClient
      customersData={customersData}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      onPageChange={handlePageChange}
      onPageSizeChange={handlePageSizeChange}
      refetch={fetchCustomers}
    />
  );
}
