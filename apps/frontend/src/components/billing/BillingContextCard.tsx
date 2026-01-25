import { BillingContext } from '@/domain/model/billing.model';
import { Calendar, CreditCard, Package } from 'lucide-react';

interface BillingContextCardProps {
    context: BillingContext;
    onClick?: () => void;
}

export default function BillingContextCard({ context, onClick }: BillingContextCardProps) {
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
            className="group bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-xl hover:border-indigo-300 transition-all duration-300 hover:-translate-y-1 cursor-pointer"
        >
            <div className="p-5 bg-gradient-to-br from-gray-50 to-white border-b border-gray-100">
                <div className="flex items-start justify-between">
                    <div>
                        <h3 className="font-bold text-lg text-gray-800 group-hover:text-indigo-600 transition-colors line-clamp-1">
                            {context.name}
                        </h3>
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
