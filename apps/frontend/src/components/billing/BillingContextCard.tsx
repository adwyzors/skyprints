import { BillingContext } from '@/domain/model/billing.model';
import { Calendar, CreditCard, Package } from 'lucide-react';

interface BillingContextCardProps {
    context: BillingContext;
    onClick?: () => void;
    selected?: boolean;
    onSelect?: (checked: boolean) => void;
}

export default function BillingContextCard({ context, onClick, selected, onSelect }: BillingContextCardProps) {
    const formatDate = (dateStr?: string) => {
        if (!dateStr) return 'N/A';
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    const formatCurrency = (amount: string | number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(Number(amount));
    };

    const isDraft = context.latestSnapshot?.isDraft ?? true;

    return (
        <div
            onClick={onClick}
            className={`group rounded-2xl border overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer ${
                selected ? 'border-blue-500 bg-blue-50/20 shadow-sm' : 'bg-white border-gray-200 hover:border-indigo-300'
            }`}
        >
            <div className={`p-5 border-b border-gray-100 ${selected ? 'bg-blue-50/50' : 'bg-gradient-to-br from-gray-50 to-white'}`}>
                <div className="flex items-start gap-3">
                    <div onClick={(e) => e.stopPropagation()} className="pt-0.5">
                        <input
                            type="checkbox"
                            checked={selected}
                            onChange={(e) => onSelect?.(e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                        />
                    </div>
                    <div className="flex-1">
                        <div className="flex items-start justify-between">
                            <div>
                                <div className="flex items-center gap-2">
                            <h3 className="font-bold text-lg text-gray-800 group-hover:text-indigo-600 transition-colors line-clamp-1">
                                {context.name}
                            </h3>
                            {context.isTest && (
                                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-orange-100 text-orange-700 border border-orange-200 rounded tracking-wider uppercase">
                                    Test
                                </span>
                            )}
                        </div>
                        {context.description && (
                            <p className="text-sm text-gray-500 mt-1 line-clamp-1">{context.description}</p>
                        )}
                    </div>
                            <span className={`px-2.5 py-1 text-xs font-semibold rounded-md border ${isDraft
                                ? 'bg-yellow-50 text-yellow-700 border-yellow-100'
                                : 'bg-green-50 text-green-700 border-green-100'
                                }`}>
                                {isDraft ? 'DRAFT' : 'FINAL'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <Package className="w-4 h-4 text-gray-400" />
                            <span className="text-xs text-gray-500">Orders</span>
                        </div>
                        <p className="text-lg font-bold text-gray-800">{context.ordersCount}</p>
                    </div>

                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <CreditCard className="w-4 h-4 text-gray-400" />
                            <span className="text-xs text-gray-500">Total</span>
                        </div>
                        <p className="text-lg font-bold text-indigo-600">
                            {context.latestSnapshot ? formatCurrency(context.latestSnapshot.result) : '-'}
                        </p>
                    </div>
                </div>

                <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Created {formatDate(context.latestSnapshot?.createdAt)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
