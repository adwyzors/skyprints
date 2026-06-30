'use client';

import { useState, useEffect } from 'react';
import { Calendar, Trash2, Loader2, X, AlertTriangle, CreditCard, Package } from 'lucide-react';
import { toast } from 'sonner';
import { BillingContext } from '@/domain/model/billing.model';
import { getBillingContextsRangePreview, deleteBillingContextsRange } from '@/services/billing.service';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

export default function DeleteBillsModal({ isOpen, onClose, onSuccess }: Props) {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [bills, setBills] = useState<BillingContext[]>([]);
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [confirmed, setConfirmed] = useState(false);

    // Fetch preview when date range changes
    useEffect(() => {
        if (!isOpen) return;
        
        if (startDate && endDate) {
            const fetchPreview = async () => {
                setLoadingPreview(true);
                try {
                    const data = await getBillingContextsRangePreview(startDate, endDate);
                    setBills(data);
                } catch (err) {
                    console.error('Error fetching range preview:', err);
                    toast.error('Failed to load bills preview for selected range');
                    setBills([]);
                } finally {
                    setLoadingPreview(false);
                }
            };
            fetchPreview();
        } else {
            setBills([]);
        }
        setConfirmed(false);
    }, [startDate, endDate, isOpen]);

    // Reset state on open/close
    useEffect(() => {
        if (isOpen) {
            setStartDate('');
            setEndDate('');
            setBills([]);
            setConfirmed(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleDelete = async () => {
        if (!startDate || !endDate || bills.length === 0 || !confirmed) return;

        setDeleting(true);
        try {
            const response = await deleteBillingContextsRange(startDate, endDate);
            toast.success(`Successfully deleted ${response.count} bill(s) and their associated orders.`);
            onSuccess?.();
            onClose();
        } catch (err) {
            console.error('Error deleting bills in range:', err);
            toast.error('Failed to delete bills. Please check permissions.');
        } finally {
            setDeleting(false);
        }
    };

    const formatCurrency = (amount: string | number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(Number(amount));
    };

    const totalAmount = bills.reduce((sum, bill) => {
        return sum + Number(bill.latestSnapshot?.result || 0);
    }, 0);

    const totalOrders = bills.reduce((sum, bill) => {
        return sum + (bill.ordersCount || 0);
    }, 0);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl border border-gray-100 flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-red-50 to-white">
                    <div className="flex items-center gap-2.5 text-red-600">
                        <Trash2 className="w-5 h-5" />
                        <h3 className="font-bold text-lg text-gray-900">Delete Bills by Date Range</h3>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={deleting}
                        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto space-y-6 flex-1 scrollbar-hide">
                    {/* Date Selectors */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Start Date</label>
                            <div className="relative">
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    disabled={deleting}
                                    className="w-full pl-3 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all bg-white"
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">End Date</label>
                            <div className="relative">
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    disabled={deleting}
                                    className="w-full pl-3 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all bg-white"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Loading Preview */}
                    {loadingPreview && (
                        <div className="flex flex-col items-center justify-center py-12 text-gray-500 space-y-3">
                            <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
                            <p className="text-sm font-medium">Scanning date range for bills...</p>
                        </div>
                    )}

                    {/* Preview Area */}
                    {!loadingPreview && startDate && endDate && (
                        <div className="space-y-4">
                            {bills.length === 0 ? (
                                <div className="p-8 text-center bg-gray-50 rounded-xl border border-gray-100 text-gray-500">
                                    <Calendar className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                                    <p className="font-semibold text-gray-700">No bills found</p>
                                    <p className="text-xs mt-1">There are no billing groups created between the selected dates.</p>
                                </div>
                            ) : (
                                <>
                                    {/* Summary Stats */}
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="bg-red-50/40 border border-red-100 rounded-xl p-3.5 space-y-1 text-center">
                                            <Trash2 className="w-4 h-4 text-red-500 mx-auto" />
                                            <p className="text-xs text-gray-500 font-medium">Bills count</p>
                                            <p className="text-xl font-bold text-red-600">{bills.length}</p>
                                        </div>
                                        <div className="bg-orange-50/40 border border-orange-100 rounded-xl p-3.5 space-y-1 text-center">
                                            <Package className="w-4 h-4 text-orange-500 mx-auto" />
                                            <p className="text-xs text-gray-500 font-medium">Associated orders</p>
                                            <p className="text-xl font-bold text-orange-600">{totalOrders}</p>
                                        </div>
                                        <div className="bg-gray-50 border border-gray-100 rounded-xl p-3.5 space-y-1 text-center">
                                            <CreditCard className="w-4 h-4 text-gray-500 mx-auto" />
                                            <p className="text-xs text-gray-500 font-medium">Total billed value</p>
                                            <p className="text-xl font-bold text-gray-700">{formatCurrency(totalAmount)}</p>
                                        </div>
                                    </div>

                                    {/* Warnings list */}
                                    <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex gap-3 text-red-700 text-xs">
                                        <AlertTriangle className="w-5 h-5 flex-shrink-0 text-red-500" />
                                        <div className="space-y-1">
                                            <p className="font-semibold">CRITICAL ACTION: Permanent Deletion</p>
                                            <ul className="list-disc list-inside space-y-0.5 text-red-600/90 font-medium">
                                                <li>All {bills.length} billing groups listed below will be deleted.</li>
                                                <li>All {totalOrders} associated orders will be permanently soft-deleted.</li>
                                                <li>All uploaded images for these orders and runs will be deleted from Cloudflare R2.</li>
                                                <li>Outstanding balances of the customers will NOT be affected.</li>
                                            </ul>
                                        </div>
                                    </div>

                                    {/* Preview Table */}
                                    <div className="border border-gray-150 rounded-xl overflow-hidden max-h-48 overflow-y-auto bg-gray-50">
                                        <table className="w-full text-left text-xs border-collapse">
                                            <thead className="bg-gray-100 text-gray-600 font-semibold sticky top-0">
                                                <tr>
                                                    <th className="px-4 py-2 border-b border-gray-150">Bill Name</th>
                                                    <th className="px-4 py-2 border-b border-gray-150">Customer</th>
                                                    <th className="px-4 py-2 border-b border-gray-150 text-right">Orders</th>
                                                    <th className="px-4 py-2 border-b border-gray-150 text-right">Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-150 text-gray-700 bg-white">
                                                {bills.map((bill) => (
                                                    <tr key={bill.id} className="hover:bg-gray-50/50">
                                                        <td className="px-4 py-2 font-medium">{bill.name}</td>
                                                        <td className="px-4 py-2 truncate max-w-[150px]" title={bill.customerNames}>
                                                            {bill.customerNames || 'N/A'}
                                                        </td>
                                                        <td className="px-4 py-2 text-right">{bill.ordersCount}</td>
                                                        <td className="px-4 py-2 text-right font-semibold text-gray-900">
                                                            {bill.latestSnapshot ? formatCurrency(bill.latestSnapshot.result) : '-'}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Confirmation Checkbox */}
                                    <label className="flex items-start gap-3 p-3 bg-red-50/20 border border-red-100 rounded-xl cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={confirmed}
                                            onChange={(e) => setConfirmed(e.target.checked)}
                                            className="mt-0.5 rounded border-gray-300 text-red-600 focus:ring-red-500 w-4 h-4 cursor-pointer"
                                        />
                                        <span className="text-xs font-semibold text-gray-700 leading-tight">
                                            I understand that this will permanently delete the selected bills, soft-delete their {totalOrders} associated orders, clean up Cloudflare images, and that this action is irreversible.
                                        </span>
                                    </label>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-3 flex-shrink-0">
                    <button
                        onClick={onClose}
                        disabled={deleting}
                        className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-500 hover:bg-gray-100 transition-colors border border-transparent disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleDelete}
                        disabled={!startDate || !endDate || bills.length === 0 || !confirmed || deleting}
                        className="px-5 py-2.5 rounded-lg text-sm font-bold text-white bg-red-600 hover:bg-red-700 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {deleting ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Deleting...
                            </>
                        ) : (
                            <>
                                <Trash2 className="w-4 h-4" />
                                Delete {bills.length} Bill{bills.length !== 1 && 's'}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
