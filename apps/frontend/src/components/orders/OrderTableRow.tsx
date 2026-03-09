'use client';

import { OrderCardData } from '@/domain/model/order.model';
import { CheckCircle, Clock, Settings } from 'lucide-react';

interface OrderTableRowProps {
    order: OrderCardData;
    index: number;
    onClick: (type?: 'row' | 'image', value?: string) => void;
    selected?: boolean;
    onSelect?: (selected: boolean) => void;
}

export default function OrderTableRow({ order, index, onClick, selected = false, onSelect }: OrderTableRowProps) {
    if (!order) return null;

    const getStatusConfig = (status: string) => {
        switch (status) {
            case 'CONFIGURE':
                return { label: 'Configure', color: 'text-orange-600 bg-orange-50', icon: <Settings className="w-4 h-4" /> };
            case 'PRODUCTION_READY':
                return { label: 'Ready', color: 'text-blue-600 bg-blue-50', icon: <Clock className="w-4 h-4" /> };
            case 'IN_PRODUCTION':
                return { label: 'In Production', color: 'text-green-600 bg-green-50', icon: <CheckCircle className="w-4 h-4" /> };
            default:
                return { label: status, color: 'text-gray-600 bg-gray-50', icon: <Clock className="w-4 h-4" /> };
        }
    };

    const statusConfig = getStatusConfig(order.status);

    return (
        <tr
            onClick={() => onClick('row')}
            className="border-b border-gray-200 hover:bg-blue-50 cursor-pointer transition-colors"
        >
            <td className="px-6 py-4 text-center">
                {/* {onSelect && (
                    <input
                        type="checkbox"
                        checked={selected}
                        onChange={(e) => {
                            e.stopPropagation();
                            onSelect(e.target.checked);
                        }}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                )} */}
            </td>
            <td className="px-6 py-4 text-center">
                <span className="font-semibold text-gray-900">{order.code.split("/")[0].replace("ORD", "")}</span>
            </td>
            <td className="px-6 py-4">
                <div className="flex flex-wrap gap-1 max-w-[120px]">
                    {order.images && order.images.length > 0 ? (
                        order.images.map((image, idx) => (
                            <div
                                key={idx}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onClick('image', image);
                                }}
                                className="w-10 h-10 rounded border border-gray-200 overflow-hidden cursor-pointer hover:border-blue-400 hover:shadow-sm transition-all group relative bg-gray-50 flex-shrink-0"
                            >
                                <img
                                    src={image}
                                    alt={`Order ${order.code} - ${idx + 1}`}
                                    className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                            </div>
                        ))
                    ) : (
                        <div className="w-10 h-10 rounded border border-gray-100 bg-gray-50 flex items-center justify-center">
                            <span className="text-gray-300 text-[10px] text-center px-1">No img</span>
                        </div>
                    )}
                </div>
            </td>

            <td className="px-6 py-4">
                <span className="text-gray-700">{order.jobCode || '-'}</span>
            </td>
            <td className="px-6 py-4">
                <span className="text-gray-700">
                    {new Date(order.createdAt).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                    })}
                </span>
            </td>
            <td className="px-6 py-4">
                <span className="text-gray-900 font-medium">{order.quantity}</span>
            </td>
            <td className="px-6 py-4">
                <span className="text-gray-700">{order.customer?.name || '-'}</span>
            </td>
            <td className="px-6 py-4">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${statusConfig.color}`}>
                    {statusConfig.icon}
                    {statusConfig.label}
                </span>
            </td>
        </tr>
    );
}
