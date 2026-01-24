'use client';

import { Grid3x3, List } from 'lucide-react';

interface OrdersViewToggleProps {
    view: 'grid' | 'table';
    onViewChange: (view: 'grid' | 'table') => void;
}

export default function OrdersViewToggle({ view, onViewChange }: OrdersViewToggleProps) {
    return (
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
                onClick={() => onViewChange('grid')}
                className={`p-2 rounded-md transition-colors ${view === 'grid'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                title="Grid view"
            >
                <Grid3x3 className="w-4 h-4" />
            </button>
            <button
                onClick={() => onViewChange('table')}
                className={`p-2 rounded-md transition-colors ${view === 'table'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                title="Table view"
            >
                <List className="w-4 h-4" />
            </button>
        </div>
    );
}
