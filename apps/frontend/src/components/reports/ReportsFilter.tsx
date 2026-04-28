'use client';

import { Filter, X, Calendar, User, Activity } from 'lucide-react';
import SearchableCustomerSelect from '../common/SearchableCustomerSelect';
import SearchableProcessSelect from '../common/SearchableProcessSelect';
import { ReportsQuery } from '@/domain/model/reports.model';
import { useEffect, useState } from 'react';
import { getCustomers } from '@/services/customer.service';
import { getProcesses } from '@/services/process.service';
import { Customer } from '@/domain/model/customer.model';
import { ProcessSummary } from '@/domain/model/process.model';

interface ReportsFilterProps {
    onClose: () => void;
    query: ReportsQuery;
    onQueryChange: (query: ReportsQuery) => void;
}

export default function ReportsFilter({ onClose, query, onQueryChange }: ReportsFilterProps) {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [processes, setProcesses] = useState<ProcessSummary[]>([]);

    useEffect(() => {
        const loadFilterData = async () => {
            try {
                const [customerData, processData] = await Promise.all([
                    getCustomers(),
                    getProcesses()
                ]);
                setCustomers(customerData);
                setProcesses(processData);
            } catch (error) {
                console.error('Failed to load filter data:', error);
            }
        };
        loadFilterData();
    }, []);

    const handleCustomerChange = (customerId: string) => {
        onQueryChange({ ...query, customerId });
    };

    const handleProcessChange = (processId: string) => {
        onQueryChange({ ...query, processId });
    };

    const handleDateChange = (type: 'startDate' | 'endDate', value: string) => {
        onQueryChange({ ...query, [type]: value });
    };

    const clearFilters = () => {
        onQueryChange({
            customerId: '',
            processId: '',
            startDate: '',
            endDate: ''
        });
    };

    const hasFilters = query.customerId || query.processId || query.startDate || query.endDate;

    return (
        <div className="flex flex-col h-full bg-white">
            <div className="flex items-center justify-between p-4 border-b">
                <div className="flex items-center gap-2 font-bold text-gray-800">
                    <Filter className="w-4 h-4 text-blue-600" />
                    <span>Report Filters</span>
                </div>
                <button
                    onClick={onClose}
                    className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                >
                    <X className="w-5 h-5 text-gray-400" />
                </button>
            </div>

            <div className="p-4 space-y-6 flex-1 overflow-y-auto scrollbar-hide">
                {/* Customer Filter */}
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                        <User className="w-3 h-3" />
                        Customer
                    </label>
                    <SearchableCustomerSelect
                        customers={customers}
                        selectedCustomerId={query.customerId || null}
                        onSelect={handleCustomerChange}
                    />
                </div>

                {/* Process Filter */}
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                        <Activity className="w-3 h-3" />
                        Process
                    </label>
                    <SearchableProcessSelect
                        processes={processes}
                        selectedProcessId={query.processId || null}
                        onSelect={handleProcessChange}
                    />
                </div>

                {/* Date Filters */}
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                        <Calendar className="w-3 h-3" />
                        Date Range
                    </label>
                    <div className="space-y-3">
                        <div>
                            <span className="text-[10px] text-gray-400 uppercase">From</span>
                            <input
                                type="date"
                                value={query.startDate || ''}
                                onChange={(e) => handleDateChange('startDate', e.target.value)}
                                className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            />
                        </div>
                        <div>
                            <span className="text-[10px] text-gray-400 uppercase">To</span>
                            <input
                                type="date"
                                value={query.endDate || ''}
                                onChange={(e) => handleDateChange('endDate', e.target.value)}
                                className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-4 border-t bg-gray-50">
                <button
                    onClick={clearFilters}
                    disabled={!hasFilters}
                    className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${
                        hasFilters 
                        ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-100' 
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                    }`}
                >
                    Clear All Filters
                </button>
            </div>
        </div>
    );
}
