import { useAuth } from '@/auth/AuthProvider';
import { Permission } from '@/auth/permissions';
import SearchableCustomerSelect from '@/components/common/SearchableCustomerSelect';
import { getCustomers } from '@/services/customer.service';
import { getLocations } from '@/services/location.service';
import { X } from 'lucide-react';
import { useEffect, useState } from 'react';

interface OrdersFilterProps {
    filters: {
        status: string[];
        dateRange: string;
        customerId: string;
        locationId: string;
    };
    onChange: (newFilters: any) => void;
    onClear: () => void;
    onClose?: () => void;
}

export default function OrdersFilter({ filters, onChange, onClear, onClose }: OrdersFilterProps) {
    const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
    const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
    const { hasPermission } = useAuth();

    useEffect(() => {
        const fetchFilters = async () => {
            try {
                const [custs, locs] = await Promise.all([
                    getCustomers(),
                    getLocations()
                ]);
                setCustomers(custs);
                setLocations(locs);
            } catch (error) {
                console.error("Failed to fetch filter data", error);
            }
        };
        fetchFilters();
    }, []);



    return (
        <div className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-gray-900 text-lg">Filters</h3>
                <div className="flex items-center gap-2">
                    <button
                        onClick={onClear}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
                    >
                        Reset
                    </button>
                    {onClose && (
                        <button onClick={onClose} className="lg:hidden text-gray-400 hover:text-gray-600">
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>

            <div className="space-y-6 flex-1 overflow-y-auto pr-2 custom-scrollbar">



                {/* Date Range */}
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Created Date</label>
                    <select
                        value={filters.dateRange}
                        onChange={(e) => onChange({ ...filters, dateRange: e.target.value })}
                        className="w-full text-sm border-gray-200 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-gray-50/50"
                    >
                        <option value="all">All Time</option>
                        <option value="today">Today</option>
                        <option value="week">This Week</option>
                        <option value="month">This Month</option>
                        <option value="quarter">This Quarter</option>
                    </select>
                </div>

                {/* Location */}
                {hasPermission(Permission.LOCATIONS_ALL_VIEW) && (
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Location</label>
                        <select
                            value={filters.locationId}
                            onChange={(e) => onChange({ ...filters, locationId: e.target.value })}
                            className="w-full text-sm border-gray-200 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-gray-50/50"
                        >
                            <option value="all">All Locations</option>
                            {locations.map(loc => (
                                <option key={loc.id} value={loc.id}>{loc.name}</option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Customer */}
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Customer</label>
                    <SearchableCustomerSelect
                        customers={customers}
                        selectedCustomerId={filters.customerId === 'all' ? null : filters.customerId}
                        onSelect={(id) => onChange({ ...filters, customerId: id || 'all' })}
                        placeholder="Search customers..."
                        allowClear={false}
                        inputClassName="w-full text-sm border-gray-200 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-gray-50/50 px-3 py-2"
                    />
                </div>
            </div>
        </div>
    );
}
