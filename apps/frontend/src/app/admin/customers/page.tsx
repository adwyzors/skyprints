export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { getCustomers } from '@/services/customer.service';
import CustomerClient from './CustomerClient';

export default async function CustomerPage() {
  const customers = await getCustomers();

  return <CustomerClient initialCustomers={customers} />;
}
