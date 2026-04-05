'use client';

import SearchableCustomerSelect from '@/components/common/SearchableCustomerSelect';
import { getCustomers } from '@/services/customer.service';
import { X } from 'lucide-react';
import { useEffect, useState } from 'react';

interface BillingFilterProps {
    filters: {
        dateRange: string;
        customerId: string;
        startDate?: string;
        endDate?: string;
        isTest?: string;
    };
    onChange: (newFilters: any) => void;
    onClear: () => void;
    onClose?: () => void;
}

export default function BillingFilter({ filters, onChange, onClear, onClose }: BillingFilterProps) {
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
                {/* Order Type */}
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Order Type</label>
                    <div className="grid grid-cols-2 gap-2">
                        {[
                            { value: 'false', label: 'Standard' },
                            { value: 'true', label: 'Test' }
                        ].map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => onChange({ ...filters, isTest: opt.value })}
                                className={`px-3 py-2 text-xs font-bold rounded-lg border transition-all ${filters.isTest === opt.value
                                    ? 'bg-blue-600 border-blue-600 text-white shadow-md'
                                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-200'
                                    }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Date Range */}
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Created Date</label>
                    <div className="space-y-3">
                        <select
                            value={filters.dateRange}
                            onChange={(e) => {
                                const val = e.target.value;
                                onChange({
                                    ...filters,
                                    dateRange: val,
                                    ...(val !== 'custom' && { startDate: '', endDate: '' })
                                });
                            }}
                            className="w-full text-sm border-gray-200 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-gray-50/50"
                        >
                            <option value="all">All Time</option>
                            <option value="today">Today</option>
                            <option value="week">This Week</option>
                            <option value="month">This Month</option>
                            <option value="quarter">This Quarter</option>
                            <option value="custom">Custom Range</option>
                        </select>

                        {filters.dateRange === 'custom' && (
                            <div className="grid grid-cols-1 gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">From</label>
                                    <input
                                        type="date"
                                        value={filters.startDate || ''}
                                        onChange={(e) => onChange({ ...filters, startDate: e.target.value })}
                                        className="w-full text-xs border-gray-200 rounded-lg focus:ring-blue-500 bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">To</label>
                                    <input
                                        type="date"
                                        value={filters.endDate || ''}
                                        onChange={(e) => onChange({ ...filters, endDate: e.target.value })}
                                        className="w-full text-xs border-gray-200 rounded-lg focus:ring-blue-500 bg-white"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

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
