'use client';

interface OrderStatusFilterProps {
    selectedStatuses: string[];
    onChange: (newStatuses: string[]) => void;
}

export default function OrderStatusFilter({ selectedStatuses, onChange }: OrderStatusFilterProps) {
    const handleStatusChange = (status: string) => {
        const current = selectedStatuses;
        const next = current.includes(status)
            ? current.filter(s => s !== status)
            : [...current, status];
        onChange(next);
    };

    const statusOptions = [
        { value: 'CONFIGURE', label: 'To Configure', color: 'purple' },
        { value: 'PRODUCTION_READY', label: 'Ready', color: 'yellow' },
        { value: 'IN_PRODUCTION', label: 'In Production', color: 'blue' },
        { value: 'COMPLETE', label: 'Complete', color: 'green' },
    ];

    return (
        <div className="flex flex-wrap gap-2 items-center py-2 px-4 border-b border-gray-200 bg-white">
            <span className="text-sm font-medium text-gray-500 mr-2">Status:</span>
            {statusOptions.map(option => (
                <button
                    key={option.value}
                    onClick={() => handleStatusChange(option.value)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${selectedStatuses.includes(option.value)
                        ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300'
                        }`}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}
