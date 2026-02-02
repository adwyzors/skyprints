'use client';

import { OrderCardData } from '@/domain/model/order.model';
import { CheckCircle, Clock, Settings } from 'lucide-react';

interface OrderTableRowProps {
    order: OrderCardData;
    index: number;
    onClick: (type?: 'row' | 'image', value?: string) => void;
}

export default function OrderTableRow({ order, index, onClick }: OrderTableRowProps) {
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
            <td className="px-6 py-4">
                <span className="text-gray-600">{index}</span>
            </td>
            <td className="px-6 py-4">
                {order.images && order.images.length > 0 ? (
                    <div
                        onClick={(e) => {
                            e.stopPropagation();
                            onClick('image', order.images[0]);
                        }}
                        className="w-12 h-12 rounded-lg border border-gray-200 overflow-hidden cursor-pointer hover:border-blue-400 hover:shadow-md transition-all group relative bg-gray-50"
                    >
                        <img
                            src={order.images[0]}
                            alt={`Order ${order.code}`}
                            className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                    </div>
                ) : (
                    <div className="w-12 h-12 rounded-lg border border-gray-100 bg-gray-50 flex items-center justify-center">
                        <span className="text-gray-300 text-xs text-center px-1">No img</span>
                    </div>
                )}
            </td>
            <td className="px-6 py-4 text-center">
                <span className="font-semibold text-gray-900">{order.code.split("/")[0].replace("ORD", "")}</span>
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
