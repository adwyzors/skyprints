'use client';

import { getCustomers } from '@/services/customer.service';
import { X } from 'lucide-react';
import { useEffect, useState } from 'react';

interface OrdersFilterProps {
    filters: {
        status: string[];
        dateRange: string;
        customerId: string;
    };
    onChange: (newFilters: any) => void;
    onClear: () => void;
    onClose?: () => void;
}

export default function OrdersFilter({ filters, onChange, onClear, onClose }: OrdersFilterProps) {
    const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);

    useEffect(() => {
        const fetchCustomers = async () => {
            try {
                const custs = await getCustomers();
                setCustomers(custs);
            } catch (error) {
                console.error("Failed to fetch customers", error);
            }
        };
        fetchCustomers();
    }, []);

    const handleStatusChange = (status: string) => {
        const current = filters.status;
        const next = current.includes(status)
            ? current.filter(s => s !== status)
            : [...current, status];
        onChange({ ...filters, status: next });
    };

    const statusOptions = [
        { value: 'CONFIGURE', label: 'To Configure', color: 'purple' },
        { value: 'PRODUCTION_READY', label: 'Ready', color: 'yellow' },
        { value: 'IN_PRODUCTION', label: 'In Production', color: 'blue' },
        { value: 'COMPLETE', label: 'Complete', color: 'green' },
    ];

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

                {/* Status */}
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Status</label>
                    <div className="flex flex-wrap gap-2">
                        {statusOptions.map(option => (
                            <button
                                key={option.value}
                                onClick={() => handleStatusChange(option.value)}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${filters.status.includes(option.value)
                                    ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300'
                                    }`}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>

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

                {/* Customer */}
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Customer</label>
                    <select
                        value={filters.customerId}
                        onChange={(e) => onChange({ ...filters, customerId: e.target.value })}
                        className="w-full text-sm border-gray-200 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-gray-50/50"
                    >
                        <option value="all">All Customers</option>
                        {customers.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                </div>
            </div>
        </div>
    );
}
