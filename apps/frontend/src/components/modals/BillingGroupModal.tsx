'use client';

import { useAuth } from '@/auth/AuthProvider';
import { Permission } from '@/auth/permissions';
import { BillingContextDetails } from '@/domain/model/billing.model';
import { getRunBillingMetrics } from '@/services/billing-calculator';
import { getBillingContextById } from '@/services/billing.service';
import { reorderOrder } from '@/services/orders.service';
import {
    Calendar,
    CreditCard,
    Download,
    ExternalLink,
    Loader2,
    Package,
    RefreshCw,
    X
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

// Import for PDF generation
import InvoicePDF from '@/components/billing/InvoicePDF';
import { pdf } from '@react-pdf/renderer';

interface BillingGroupModalProps {
    isOpen: boolean;
    onClose: () => void;
    groupId: string;
}

export default function BillingGroupModal({ isOpen, onClose, groupId }: BillingGroupModalProps) {
    const [loading, setLoading] = useState(true);
    const [details, setDetails] = useState<BillingContextDetails | null>(null);
    const [creditLimitError, setCreditLimitError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && groupId) {
            setLoading(true);
            getBillingContextById(groupId)
                .then(setDetails)
                .catch((err) => console.error('Failed to fetch group details:', err))
                .finally(() => setLoading(false));
        } else {
            setDetails(null);
        }
    }, [isOpen, groupId]);

    const handleDownloadInvoice = async () => {
        if (!details) return;

        try {
            // Check if all orders belong to the same customer
            const firstCustomer = details.orders[0]?.customer?.name;
            const differentCustomers = details.orders.some(o => o.customer?.name !== firstCustomer);

            if (differentCustomers) {
                alert("Cannot generate invoice: All orders in a group must belong to the same customer.");
                return;
            }

            const snapshot = details.latestSnapshot;

            if (!snapshot) {
                alert("No billing snapshot found for this group.");
                return;
            }

            // Determine total amount: prefer finalAmount if it's a non-zero value, otherwise fall back to snapshot.result
            const totalAmt = (snapshot.finalAmount && Number(snapshot.finalAmount) !== 0)
                ? snapshot.finalAmount
                : snapshot.result ?? '0';

            // Prepare fallback values for older snapshots. Treat '0' or null/undefined as missing.
            let subTotal = (snapshot.subTotalAmount && Number(snapshot.subTotalAmount) !== 0)
                ? snapshot.subTotalAmount
                : null;
            let taxPerc = (snapshot.taxPercentage && Number(snapshot.taxPercentage) !== 0)
                ? snapshot.taxPercentage
                : null;
            let taxAmt = (snapshot.taxAmount && Number(snapshot.taxAmount) !== 0)
                ? snapshot.taxAmount
                : null;

            // If subTotal is missing, derive it from total and tax information
            if (!subTotal) {
                if (snapshot.taxEnabled && taxAmt) {
                    // total = subTotal + taxAmount
                    const calculatedSub = (Number(totalAmt) - Number(taxAmt)).toFixed(2);
                    subTotal = calculatedSub;
                } else {
                    // No tax applied; subtotal equals total amount
                    subTotal = totalAmt;
                }
            }

            // If tax percentage missing but tax is enabled, compute it
            if (!taxPerc && snapshot.taxEnabled && taxAmt && subTotal) {
                const perc = (Number(taxAmt) / Number(subTotal) * 100).toFixed(2);
                taxPerc = perc;
            }

            let tdsEnabled = snapshot.tdsEnabled ?? false;
            let tdsPerc = snapshot.tdsPercentage || '0';
            let tdsAmt = snapshot.tdsAmount || '0';

            // Fallback for older snapshots
            const snapshotInputs = snapshot.inputs as any;
            if (!tdsEnabled && snapshotInputs?.__TDS_METADATA__) {
                const meta = snapshotInputs.__TDS_METADATA__;
                tdsEnabled = !!meta.tdsEnabled;
                tdsPerc = String(meta.tdsPercentage || '0');
                tdsAmt = String(meta.tdsAmount || '0');
            }

            // Mathematical fallback for TDS (when updated via script and missing __TDS_METADATA__)
            if (!tdsEnabled && subTotal && totalAmt) {
                const expectedWithoutTds = Number(subTotal) + Number(taxAmt || '0');
                const diff = expectedWithoutTds - Number(totalAmt);
                if (diff > 0.01) {
                    tdsEnabled = true;
                    tdsAmt = diff.toFixed(2);
                    tdsPerc = (diff / Number(subTotal) * 100).toFixed(2);
                }
            }



            let finalTotal = totalAmt;
            if (tdsEnabled && tdsAmt && Number(tdsAmt) > 0) {
                const expectedWithoutTds = Number(subTotal || '0') + Number(taxAmt || '0');
                if (Math.abs(Number(totalAmt) - expectedWithoutTds) < 0.01) {
                    finalTotal = (Number(totalAmt) - Number(tdsAmt)).toFixed(2);
                }
            }

            const invoiceData = {
                heading: snapshot.taxEnabled ? 'Tax Invoice' : 'Delivery Challan',

                companyName: 'Sky Art Prints LLP',
                companyAddress: '13, Bhavani Complex, Bhavani Shankar Road, Dadar West, Mumbai 400053',
                msmeReg: 'MSME Reg#: UDYAM-MH-19-0217047',

                gstin: details.orders[0]?.customer?.gstno || 'NA',

                billTo: details.orders[0]?.customer?.name || 'NA',
                address: details.orders[0]?.customer?.address || 'NA',
                date: (details.createdAt || snapshot.createdAt)
                    ? new Date(details.createdAt || snapshot.createdAt).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                    })
                    : 'NA',
                billNumber: details.name,

                items: details.orders.map((order, index) => {
                    let actualQty = 0;
                    order.processes?.forEach((process: any) => {
                        process.runs?.forEach((run: any) => {
                            const metrics = getRunBillingMetrics(run, process.name, order.quantity);
                            if (metrics.quantity > actualQty) {
                                actualQty = metrics.quantity;
                            }
                        });
                    });
                    const billingQty = actualQty > 0 ? actualQty : order.quantity;

                    return {
                        srNo: index + 1,
                        orderCode: order.code,
                        jobCode: order.jobCode || '',
                        quantity: billingQty,
                        rate:
                            order.billing?.result && billingQty > 0
                                ? (Number(order.billing.result) / billingQty).toFixed(2)
                                : '0.00',
                        amount: order.billing?.result || '0',
                    };
                }),

                // Use derived values with graceful fallback
                subtotal: subTotal || '0',
                taxPercentage: taxPerc || '0',
                taxAmount: taxAmt || '0',
                total: finalTotal,
                taxEnabled: snapshot.taxEnabled ?? false,
                tdsEnabled,
                tdsPercentage: tdsPerc,
                tdsAmount: tdsAmt,
            };

            // Generate PDF blob
            const blob = await pdf(<InvoicePDF invoiceData={invoiceData} />).toBlob();

            // Create download link
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `invoice_${details.orders[0]?.customer?.name.replace(/\s+/g, '_')}_${details.name}_${new Date().toISOString().split('T')[0]}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error generating invoice:', error);
            alert('Failed to generate invoice. Please try again.');
        }
    };

    if (!isOpen) return null;

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return 'N/A';
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };


    const formatCurrency = (amount: string | number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 2,
        }).format(Number(amount));
    };


    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-6 border-b border-gray-100 shrink-0">
                    <h2 className="text-xl font-bold text-gray-800">Billing Group Details</h2>
                    <div className="flex items-center gap-2">
                        {details && !loading && (
                            <button
                                onClick={handleDownloadInvoice}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                <Download className="w-4 h-4" />
                                Download Invoice
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="p-2 -mr-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
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
                                        <span
                                            className={`px-2.5 py-1 text-xs font-semibold rounded-md border ${(details.latestSnapshot?.isDraft ?? true)
                                                ? 'bg-yellow-50 text-yellow-700 border-yellow-100'
                                                : 'bg-green-50 text-green-700 border-green-100'
                                                }`}
                                        >
                                            {(details.latestSnapshot?.isDraft ?? true) ? 'DRAFT' : 'FINAL'}
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
                                                {details.latestSnapshot
                                                    ? formatCurrency(details.latestSnapshot.result)
                                                    : '-'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Additional Meta */}
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                                <Calendar className="w-4 h-4" />
                                <span>Created: {formatDate(details.createdAt || details.latestSnapshot?.createdAt)}</span>
                            </div>

                            {/* Order List */}
                            <div className="space-y-3">
                                <div className="text-sm font-medium text-gray-700">
                                    Associated Orders ({details.orders.length})
                                </div>
                                <div className="space-y-3">
                                    {details.orders.map((order) => (
                                        <OrderGroupItem
                                            key={order.id}
                                            order={order}
                                            formatCurrency={formatCurrency}
                                            getRunBillingMetrics={getRunBillingMetrics}
                                            onCreditLimitError={(msg) => setCreditLimitError(msg)}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-12 text-gray-500">Failed to load group details.</div>
                    )}
                </div>
            </div>

            {/* CREDIT LIMIT ERROR DIALOG */}
            {creditLimitError && (
                <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in zoom-in duration-200">
                    <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden p-8 text-center border border-red-100">
                        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                            <span className="text-3xl">⚠️</span>
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">Credit Limit Reached</h3>
                        <p className="text-gray-500 text-sm leading-relaxed mb-8">
                            This reorder cannot be completed because the customer has exceeded their assigned credit limit. 
                            <br/><br/>
                            Please contact administration to adjust the limit or settle outstanding payments.
                        </p>
                        <button
                            onClick={() => setCreditLimitError(null)}
                            className="w-full py-3.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 active:scale-[0.98] transition-all shadow-lg shadow-red-200 flex items-center justify-center"
                        >
                            Understood
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function OrderGroupItem({
    order,
    formatCurrency,
    getRunBillingMetrics,
    onCreditLimitError,
}: {
    order: any;
    formatCurrency: (val: number | string) => string;
    getRunBillingMetrics: (run: any, processName: string, quantity: number) => { quantity: number; amount: number; ratePerPc: number };
    onCreditLimitError: (msg: string) => void;
}) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isReordering, setIsReordering] = useState(false);
    const router = useRouter(); // Initialized useRouter

    const { hasPermission } = useAuth();


    const handleReorder = async () => {
        if (!confirm('Are you sure you want to reorder this item?')) return;

        try {
            setIsReordering(true);
            const res = await reorderOrder(order.id); // Captured response
            alert('Order reordered successfully!');
            // Check if response has the ID we need
            if (res && res.id) {
                router.push(`/admin/orders?selectedOrder=${res.id}`);
            }
        } catch (error: any) {
            console.error('Failed to reorder:', error);
            const msg = error.message || '';
            if (msg.toLowerCase().includes('credit limit reached')) {
                onCreditLimitError('Credit limit reached for this customer.');
            } else {
                alert('Failed to reorder. Please try again.');
            }
        } finally {
            setIsReordering(false);
        }
    };

    return (
        <div className="border border-gray-200 rounded-xl overflow-hidden transition-all duration-200 hover:shadow-md">
            <div
                className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
            >

                <div className="flex items-center gap-3">
                    {hasPermission(Permission.ORDERS_REORDER) && (
                        <button
                            onClick={handleReorder}
                            disabled={isReordering}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isReordering ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <RefreshCw className="w-4 h-4" />
                            )}
                            {isReordering ? 'Reordering...' : 'Reorder'}
                        </button>
                    )}
                    <div>
                        <Link
                            href={`/admin/orders/${order.id}`}
                            className="font-semibold text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                        >
                            {order.code}
                        </Link>
                        <div className="text-xs text-gray-500">{order.customer?.name}</div>
                    </div>
                </div>
                <div className="text-right">
                    <div className="font-bold text-gray-900">
                        {order.billing?.result ? formatCurrency(order.billing.result) : '-'}
                    </div>
                    <div className="text-xs text-gray-500">{order.quantity} units</div>
                </div>

            </div>
        </div>
    );
}
