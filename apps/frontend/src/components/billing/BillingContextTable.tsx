import { BillingContext } from '@/domain/model/billing.model';
import { Calendar, ChevronRight } from 'lucide-react';

interface BillingContextTableProps {
    data: BillingContext[];
    startIndex: number;
    onRowClick?: (id: string) => void;
}

export default function BillingContextTable({ data, startIndex, onRowClick }: BillingContextTableProps) {
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

    return (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                            <th className="px-6 py-4 font-semibold text-gray-700 w-16">Sr No</th>
                            <th className="px-6 py-4 font-semibold text-gray-700">Bill Name</th>
                            <th className="px-6 py-4 font-semibold text-gray-700">Date</th>
                            <th className="px-6 py-4 font-semibold text-gray-700">Customer</th>
                            <th className="px-6 py-4 font-semibold text-gray-700">Job & Description</th>
                            <th className="px-6 py-4 font-semibold text-gray-700 text-center">Orders</th>
                            <th className="px-6 py-4 font-semibold text-gray-700 text-right">Total</th>
                            <th className="px-6 py-4 font-semibold text-gray-700 w-10"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {data.map((context, index) => {
                            const isDraft = context.latestSnapshot?.isDraft ?? true;

                            return (
                                <tr
                                    key={context.id}
                                    onClick={() => onRowClick?.(context.id)}
                                    className="hover:bg-gray-50 transition-colors cursor-pointer group"
                                >
                                    <td className="px-6 py-4 text-gray-500">
                                        {startIndex + index + 1}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-semibold text-gray-800 group-hover:text-indigo-600 transition-colors">
                                            {context.name}
                                        </div>
                                        {context.description && (
                                            <div className="text-xs text-gray-500 mt-0.5 max-w-xs truncate">
                                                {context.description}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-gray-600 font-medium">
                                        <div className="flex items-center gap-2">
                                            <Calendar className="w-4 h-4 text-gray-400" />
                                            {formatDate(context.latestSnapshot?.createdAt)}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm text-gray-900 font-semibold max-w-[150px] truncate" title={context.customerNames}>
                                            {context.customerNames || '-'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-xs text-gray-500 max-w-[200px] truncate" title={context.jobCodes}>
                                            {context.jobCodes || '-'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                            {context.ordersCount}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right font-medium text-gray-900">
                                        {context.latestSnapshot ? formatCurrency(context.latestSnapshot.result) : '-'}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-indigo-400 transition-colors" />
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
