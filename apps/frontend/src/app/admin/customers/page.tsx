'use client';
import { Customer } from '@/domain/model/customer.model';
import { getCustomers } from '@/services/customer.service';
import { useEffect, useState } from 'react';
import CustomerClient from './CustomerClient';

export default function CustomerClientWrapper() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCustomers()
      .then((res) => setCustomers(res))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading...</p>;

  return <CustomerClient initialCustomers={customers} />;
}
