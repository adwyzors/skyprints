'use client';

import { Filter, X } from 'lucide-react';

interface BillsFilterProps {
    onClose: () => void;
    // Add other filter props here if needed
}

export default function BillsFilter({ onClose }: BillsFilterProps) {
    return (
        <div className="flex flex-col h-full bg-white">
            <div className="flex items-center justify-between p-4 border-b">
                <div className="flex items-center gap-2 font-bold text-gray-800">
                    <Filter className="w-4 h-4 text-blue-600" />
                    <span>Filters</span>
                </div>
                <button
                    onClick={onClose}
                    className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                >
                    <X className="w-5 h-5 text-gray-400" />
                </button>
            </div>

            <div className="p-4 space-y-6 flex-1 overflow-y-auto scrollbar-hide">
                {/* Placeholder for future filters */}
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Status</label>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-50 text-blue-700 border border-blue-100 text-sm font-medium">
                            All Billing Groups
                        </div>
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Quick Links</label>
                    <div className="space-y-1">
                        <button className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">
                            Recent Groups
                        </button>
                        <button className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">
                            High Priority
                        </button>
                    </div>
                </div>
            </div>

            <div className="p-4 border-t bg-gray-50">
                <button
                    disabled
                    className="w-full py-2 bg-gray-200 text-gray-500 rounded-lg text-sm font-medium cursor-not-allowed"
                >
                    No filters active
                </button>
            </div>
        </div>
    );
}
