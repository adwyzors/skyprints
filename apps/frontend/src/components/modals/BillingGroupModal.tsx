"use client";

import { BillingContextDetails } from "@/domain/model/billing.model";
import { getBillingContextById } from "@/services/billing.service";
import { Calendar, ChevronDown, CreditCard, ExternalLink, Loader2, Package, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

interface BillingGroupModalProps {
    isOpen: boolean;
    onClose: () => void;
    groupId: string;
}

export default function BillingGroupModal({
    isOpen,
    onClose,
    groupId,
}: BillingGroupModalProps) {
    const [loading, setLoading] = useState(true);
    const [details, setDetails] = useState<BillingContextDetails | null>(null);

    useEffect(() => {
        if (isOpen && groupId) {
            setLoading(true);
            getBillingContextById(groupId)
                .then(setDetails)
                .catch((err) => console.error("Failed to fetch group details:", err))
                .finally(() => setLoading(false));
        } else {
            setDetails(null);
        }
    }, [isOpen, groupId]);

    if (!isOpen) return null;

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return 'N/A';
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-6 border-b border-gray-100 shrink-0">
                    <h2 className="text-xl font-bold text-gray-800">Billing Group Details</h2>
                    <button
                        onClick={onClose}
                        className="p-2 -mr-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12 text-blue-600">
                            <Loader2 className="w-8 h-8 animate-spin mb-3" />
                            <p className="text-sm font-medium text-gray-500">Loading details...</p>
                        </div>
                    ) : details ? (
                        <div className="space-y-6">
                            {/* Header Info */}
                            <div className="bg-gray-50 p-5 rounded-xl border border-gray-100 space-y-4">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <Link
                                            href={`/admin/bills/${details.id}`}
                                            className="group/link inline-flex items-center gap-2 hover:text-indigo-600 transition-colors"
                                        >
                                            <h3 className="font-bold text-lg text-gray-900 group-hover/link:text-indigo-600 underline decoration-dotted decoration-gray-300 underline-offset-4 hover:decoration-indigo-300">
                                                {details.name}
                                            </h3>
                                            <ExternalLink className="w-4 h-4 opacity-50 group-hover/link:opacity-100" />
                                        </Link>
                                        {details.description && (
                                            <p className="text-gray-500 text-sm mt-1">{details.description}</p>
                                        )}
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        <span className={`px-2.5 py-1 text-xs font-semibold rounded-md border ${details.latestSnapshot?.isDraft ?? true
                                            ? 'bg-yellow-50 text-yellow-700 border-yellow-100'
                                            : 'bg-green-50 text-green-700 border-green-100'
                                            }`}>
                                            {details.latestSnapshot?.isDraft ?? true ? 'DRAFT' : 'FINAL'}
                                        </span>
                                        <span className="text-xs text-gray-400 font-mono">
                                            ID: {details.id.split('-')[0]}
                                        </span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 pt-2">
                                    <div className="bg-white p-3 rounded-lg border border-gray-200 flex items-center gap-3">
                                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                            <Package className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 font-medium">Orders</p>
                                            <p className="text-lg font-bold text-gray-900">{details.orders.length}</p>
                                        </div>
                                    </div>
                                    <div className="bg-white p-3 rounded-lg border border-gray-200 flex items-center gap-3">
                                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                                            <CreditCard className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 font-medium">Total Amount</p>
                                            <p className="text-lg font-bold text-gray-900">
                                                {details.latestSnapshot ? formatCurrency(details.latestSnapshot.result) : '-'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Additional Meta */}
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                                <Calendar className="w-4 h-4" />
                                <span>Created: {formatDate(details.latestSnapshot?.createdAt)}</span>
                            </div>

                            {/* Order List */}
                            <div className="space-y-3">
                                <div className="text-sm font-medium text-gray-700">
                                    Associated Orders ({details.orders.length})
                                </div>
                                <div className="space-y-3">
                                    {details.orders.map((order) => (
                                        <OrderGroupItem key={order.id} order={order} formatCurrency={formatCurrency} />
                                    ))}
                                </div>
                            </div>

                        </div>
                    ) : (
                        <div className="text-center py-12 text-gray-500">
                            Failed to load group details.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function OrderGroupItem({ order, formatCurrency }: { order: any, formatCurrency: (val: number | string) => string }) {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className="border border-gray-200 rounded-xl overflow-hidden transition-all duration-200 hover:shadow-md">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
            >
                <div className="flex items-center gap-3">
                    <div className={`p-1 rounded-full transition-transform duration-200 ${isExpanded ? 'rotate-180 bg-gray-200' : ''}`}>
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                    </div>
                    <div>
                        <div className="font-semibold text-gray-800">{order.code}</div>
                        <div className="text-xs text-gray-500">{order.customer?.name}</div>
                    </div>
                </div>
                <div className="text-right">
                    <div className="font-bold text-gray-900">
                        {order.billing?.result ? formatCurrency(order.billing.result) : '-'}
                    </div>
                    <div className="text-xs text-gray-500">{order.quantity} units</div>
                </div>
            </button>

            {isExpanded && (
                <div className="bg-white border-t border-gray-200 divide-y divide-gray-100">
                    {order.processes.map((process: any) => (
                        <div key={process.id} className="p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                <h4 className="text-sm font-semibold text-gray-700">{process.name}</h4>
                            </div>
                            <div className="pl-3.5 space-y-2">
                                {process.runs.map((run: any) => {
                                    const input = order.billing?.inputs?.[run.id];
                                    // If no input found, fallback to 0 or estimates if available, but for billing modal we expect inputs
                                    const rate = input?.new_rate ?? 0;
                                    const qty = input?.quantity ?? 0;
                                    const amount = rate * qty;

                                    return (
                                        <div key={run.id} className="flex items-center justify-between text-sm group">
                                            <div className="text-gray-600 group-hover:text-gray-900 transition-colors">
                                                {run.name}
                                                {input && (
                                                    <span className="text-xs text-gray-400 ml-2">
                                                        ({qty} × {formatCurrency(rate)})
                                                    </span>
                                                )}
                                            </div>
                                            <div className="font-medium text-gray-700">
                                                {formatCurrency(amount)}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
