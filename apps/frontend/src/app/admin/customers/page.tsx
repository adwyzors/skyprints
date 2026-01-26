import { getCustomers } from '@/services/customer.service';
import CustomerClient from './CustomerClient';

import { cookies } from 'next/headers';

export default async function CustomerPage() {
    const cookieStore = cookies();
    const customers = await getCustomers(cookieStore.toString());

    return <CustomerClient initialCustomers={customers} />;
}
