'use client';

import { useState, useEffect } from 'react';
import { Calendar, FileSpreadsheet, Loader2, X, AlertTriangle, CreditCard, Package, CheckSquare, Square } from 'lucide-react';
import { toast } from 'sonner';
import { BillingContext } from '@/domain/model/billing.model';
import { getBillingContextsRangePreview, exportBillingContextsExcel } from '@/services/billing.service';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

export default function DownloadExcelModal({ isOpen, onClose }: Props) {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [bills, setBills] = useState<BillingContext[]>([]);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [exporting, setExporting] = useState(false);

    // Fetch preview when date range changes
    useEffect(() => {
        if (!isOpen) return;
        
        if (startDate && endDate) {
            const fetchPreview = async () => {
                setLoadingPreview(true);
                try {
                    const data = await getBillingContextsRangePreview(startDate, endDate);
                    setBills(data);
                    // Select all by default
                    setSelectedIds(data.map(bill => bill.id));
                } catch (err) {
                    console.error('Error fetching range preview:', err);
                    toast.error('Failed to load bills preview for selected range');
                    setBills([]);
                    setSelectedIds([]);
                } finally {
                    setLoadingPreview(false);
                }
            };
            fetchPreview();
        } else {
            setBills([]);
            setSelectedIds([]);
        }
    }, [startDate, endDate, isOpen]);

    // Reset state on open/close
    useEffect(() => {
        if (isOpen) {
            setStartDate('');
            setEndDate('');
            setBills([]);
            setSelectedIds([]);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleToggleSelect = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    const handleSelectAllToggle = () => {
        if (selectedIds.length === bills.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(bills.map(bill => bill.id));
        }
    };

    const handleExport = async () => {
        if (selectedIds.length === 0) {
            toast.error('Please select at least one bill to export');
            return;
        }

        setExporting(true);
        try {
            const blob = await exportBillingContextsExcel(selectedIds);
            
            // Download the file
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `billing_export_${startDate}_to_${endDate}.xlsx`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            toast.success(`Successfully exported ${selectedIds.length} bill(s) to Excel.`);
            onClose();
        } catch (err) {
            console.error('Error exporting bills to Excel:', err);
            toast.error('Failed to export bills to Excel.');
        } finally {
            setExporting(false);
        }
    };

    const formatCurrency = (amount: string | number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(Number(amount));
    };

    // Calculate sum of only selected bills
    const selectedBills = bills.filter(bill => selectedIds.includes(bill.id));
    const totalAmount = selectedBills.reduce((sum, bill) => {
        return sum + Number(bill.latestSnapshot?.result || 0);
    }, 0);

    const totalOrders = selectedBills.reduce((sum, bill) => {
        return sum + (bill.ordersCount || 0);
    }, 0);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl border border-gray-150 flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-emerald-50 to-white">
                    <div className="flex items-center gap-2.5 text-emerald-700">
                        <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                        <h3 className="font-bold text-lg text-gray-900 font-sans">Download Bills Excel</h3>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={exporting}
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
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                disabled={exporting}
                                className="w-full pl-3 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all bg-white"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">End Date</label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                disabled={exporting}
                                className="w-full pl-3 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all bg-white"
                            />
                        </div>
                    </div>

                    {/* Loading Preview */}
                    {loadingPreview && (
                        <div className="flex flex-col items-center justify-center py-12 text-gray-500 space-y-3">
                            <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
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
                                        <div className="bg-emerald-50/40 border border-emerald-100 rounded-xl p-3.5 space-y-1 text-center">
                                            <FileSpreadsheet className="w-4 h-4 text-emerald-600 mx-auto" />
                                            <p className="text-xs text-gray-500 font-medium">Selected Bills</p>
                                            <p className="text-xl font-bold text-emerald-700">{selectedIds.length} / {bills.length}</p>
                                        </div>
                                        <div className="bg-blue-50/40 border border-blue-100 rounded-xl p-3.5 space-y-1 text-center">
                                            <Package className="w-4 h-4 text-blue-600 mx-auto" />
                                            <p className="text-xs text-gray-500 font-medium">Total Items</p>
                                            <p className="text-xl font-bold text-blue-600">{totalOrders}</p>
                                        </div>
                                        <div className="bg-gray-50 border border-gray-100 rounded-xl p-3.5 space-y-1 text-center">
                                            <CreditCard className="w-4 h-4 text-gray-500 mx-auto" />
                                            <p className="text-xs text-gray-500 font-medium">Total Billed Value</p>
                                            <p className="text-xl font-bold text-gray-700">{formatCurrency(totalAmount)}</p>
                                        </div>
                                    </div>

                                    {/* Preview & Selection Table */}
                                    <div className="border border-gray-150 rounded-xl overflow-hidden max-h-56 overflow-y-auto bg-gray-50 shadow-inner">
                                        <table className="w-full text-left text-xs border-collapse">
                                            <thead className="bg-gray-100 text-gray-600 font-semibold sticky top-0 z-10">
                                                <tr>
                                                    <th className="px-4 py-2 border-b border-gray-150 w-10">
                                                        <button 
                                                            type="button"
                                                            onClick={handleSelectAllToggle}
                                                            className="text-gray-500 hover:text-emerald-600 transition-colors"
                                                        >
                                                            {selectedIds.length === bills.length ? (
                                                                <CheckSquare className="w-4 h-4 text-emerald-600 fill-emerald-50" />
                                                            ) : (
                                                                <Square className="w-4 h-4 text-gray-400" />
                                                            )}
                                                        </button>
                                                    </th>
                                                    <th className="px-4 py-2 border-b border-gray-150">Bill Name</th>
                                                    <th className="px-4 py-2 border-b border-gray-150">Customer</th>
                                                    <th className="px-4 py-2 border-b border-gray-150 text-right">Items</th>
                                                    <th className="px-4 py-2 border-b border-gray-150 text-right">Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-150 text-gray-700 bg-white">
                                                {bills.map((bill) => {
                                                    const isChecked = selectedIds.includes(bill.id);
                                                    return (
                                                        <tr 
                                                            key={bill.id} 
                                                            className={`hover:bg-emerald-50/20 cursor-pointer transition-colors ${isChecked ? 'bg-emerald-50/10' : ''}`}
                                                            onClick={() => handleToggleSelect(bill.id)}
                                                        >
                                                            <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleToggleSelect(bill.id)}
                                                                    className="text-gray-500 hover:text-emerald-600 transition-colors"
                                                                >
                                                                    {isChecked ? (
                                                                        <CheckSquare className="w-4 h-4 text-emerald-600 fill-emerald-50" />
                                                                    ) : (
                                                                        <Square className="w-4 h-4 text-gray-300" />
                                                                    )}
                                                                </button>
                                                            </td>
                                                            <td className="px-4 py-2 font-medium">{bill.name}</td>
                                                            <td className="px-4 py-2 truncate max-w-[150px]" title={bill.customerNames}>
                                                                {bill.customerNames || 'N/A'}
                                                            </td>
                                                            <td className="px-4 py-2 text-right">{bill.ordersCount}</td>
                                                            <td className="px-4 py-2 text-right font-semibold text-gray-900">
                                                                {bill.latestSnapshot ? formatCurrency(bill.latestSnapshot.result) : '-'}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-3 flex-shrink-0">
                    <button
                        onClick={onClose}
                        disabled={exporting}
                        className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-500 hover:bg-gray-100 transition-colors border border-transparent disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleExport}
                        disabled={!startDate || !endDate || selectedIds.length === 0 || exporting}
                        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm hover:shadow-md transition-all disabled:opacity-50"
                    >
                        {exporting ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Exporting...
                            </>
                        ) : (
                            <>
                                <FileSpreadsheet className="w-4 h-4" />
                                Export to Excel
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
