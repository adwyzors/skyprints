'use client';

import { useAuth } from '@/auth/AuthProvider';
import { Permission } from '@/auth/permissions';
import { withAuth } from '@/auth/withAuth';
import { BillingContextDetails } from '@/domain/model/billing.model';
import { getRunBillingMetrics } from '@/services/billing-calculator';
import { getBillingContextById } from '@/services/billing.service';
import {
    AlertCircle,
    ArrowLeft,
    Calendar,
    CheckCircle2,
    ChevronDown,
    CreditCard,
    FileText,
    Loader2,
    Package,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

function BillingContextDetailPage() {
    const { contextId } = useParams<{ contextId: string }>();
    // Ensure contextId is always a string to satisfy API types
    const safeContextId = Array.isArray(contextId) ? contextId[0] : contextId;

    const router = useRouter();
    const [details, setDetails] = useState<BillingContextDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [finalizing, setFinalizing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { hasPermission } = useAuth();

    // Track editable inputs: { orderId: { runId: { new_rate: number } } }
    const [draftInputs, setDraftInputs] = useState<
        Record<string, Record<string, { new_rate: number }>>
    >({});

    // Expanded state for order cards
    const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());

    const fetchDetails = async () => {
        if (!safeContextId) return;
        setLoading(true);
        try {
            const data = await getBillingContextById(safeContextId);
            setDetails(data);
        } catch (error) {
            console.error('Failed to fetch billing context details:', error);
            setError('Failed to load billing group details');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDetails();
    }, [safeContextId]);



    const handleRateChange = (orderId: string, runId: string, val: string) => {
        const rate = parseFloat(val);
        if (isNaN(rate)) return;

        setDraftInputs((prev) => ({
            ...prev,
            [orderId]: {
                ...(prev[orderId] || {}),
                [runId]: { new_rate: rate },
            },
        }));
    };

    const handleFinalize = async () => {
        if (!safeContextId || !details) return;
        if (
            !confirm(
                'Are you sure you want to finalize this billing group? This will apply rates to all orders.',
            )
        ) {
            return;
        }

        setFinalizing(true);
        try {
            const inputsToSend: Record<string, Record<string, { new_rate: number }>> = {};
            const modifiedOrderIds = Object.keys(draftInputs);

            // Always include all orders/runs in payload if they are part of the context?
            // The logic: if finalizing, we probably want to save whatever state is current.
            // But optimal payload is inputs for all runs.

            details.orders.forEach((order) => {
                inputsToSend[order.id] = {};
                order.processes.forEach(process => {
                    process.runs.forEach(run => {
                        const metrics = getRunBillingMetrics(run, process.name, order.quantity);

                        // Check draft
                        const draftValue = draftInputs[order.id]?.[run.id];

                        // Check snapshot
                        const snapshotInputs = order.billing?.inputs || {};
                        const currentInput = snapshotInputs[run.id];

                        if (draftValue) {
                            inputsToSend[order.id][run.id] = { new_rate: draftValue.new_rate };
                        } else if (currentInput) {
                            const rate = currentInput.new_rate ?? currentInput['new_rate'] ?? 0;
                            inputsToSend[order.id][run.id] = { new_rate: rate };
                        } else {
                            inputsToSend[order.id][run.id] = { new_rate: metrics.ratePerPc };
                        }
                    });
                });
            });

            const payload = {
                billingContextId: safeContextId,
                inputs: inputsToSend,
            };

            await finalizeBillingGroupWithInputs(payload);
            setDraftInputs({});
            await fetchDetails();
            alert('Billing group finalized successfully!');
        } catch (error) {
            console.error('Failed to finalize group:', error);
            alert('Failed to finalize billing group');
        } finally {
            setFinalizing(false);
        }
    };

    const toggleOrderExpansion = (orderId: string) => {
        setExpandedOrders((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(orderId)) {
                newSet.delete(orderId);
            } else {
                newSet.add(orderId);
            }
            return newSet;
        });
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return 'N/A';
        return new Date(dateStr).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    };

    const formatCurrency = (amount: string | number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 2,
        }).format(Number(amount));
    };

    const parseJsonItems = (items: unknown): any[] => {
        if (Array.isArray(items)) return items;
        if (typeof items === 'string') {
            try {
                const parsed = JSON.parse(items);
                return Array.isArray(parsed) ? parsed : [];
            } catch {
                return [];
            }
        }
        return [];
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
        );
    }

    if (error || !details) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 text-gray-500">
                <p className="text-lg font-bold">{error || 'Billing Group Not Found'}</p>
                <Link href="/admin/bills" className="mt-4 text-blue-600 hover:underline">
                    Return to Bills
                </Link>
            </div>
        );
    }

    // Calculate total amount dynamically
    let displayTotalAmount = 0;
    if (details) {
        details.orders.forEach((order) => {
            order.processes.forEach((p) => {
                p.runs.forEach((r) => {
                    const metrics = getRunBillingMetrics(r, p.name, order.quantity);
                    const snapshotInput = order.billing?.inputs?.[r.id];

                    // The bug was that snapshotInput?.new_rate might be a "raw" rate (e.g. 3 for Plotter)
                    // while the backend result was calculated using the effective rate (13.40).
                    // We should use metrics.ratePerPc which is derived from backend's intended amount,
                    // unless a draft edit exists.
                    const baseRate = metrics.ratePerPc;

                    // If we have a saved new_rate that is DIFFERENT from the original raw rate in run values,
                    // it might be a user-saved override from a previous session.
                    // But for simplicity and to match the backend result display, we prioritize metrics.ratePerPc
                    // as the starting point for the dashboard view.
                    const effectiveRate = draftInputs[order.id]?.[r.id]?.new_rate ?? snapshotInput?.new_rate ?? baseRate;
                    const qty = snapshotInput?.quantity ?? metrics.quantity;

                    displayTotalAmount += effectiveRate * qty;
                });
            });
        });

        // Final safety check: If no edits in draftInputs, and we have a snapshot result, use it!
        // This ensures the "Total Amount" header always matches the "result" from backend if not modified.
        if (Object.keys(draftInputs).length === 0 && details.latestSnapshot?.result) {
            displayTotalAmount = Number(details.latestSnapshot.result);
        }
    }

    return (
        <div className="flex h-full bg-gray-50 overflow-hidden scrollbar-hide">
            {/* LEFT COLUMN: Fixed Sidebar */}
            <div className="w-[400px] shrink-0 border-r border-gray-200 bg-white shadow-lg overflow-y-auto scrollbar-hide z-10 flex flex-col">
                <div className="p-6 bg-gradient-to-br from-gray-50 to-white border-b border-gray-100 shrink-0">
                    <Link
                        href="/admin/bills"
                        className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors mb-4"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Bills
                    </Link>

                    <div className="flex items-center gap-2 mb-2">
                        <span className="inline-block px-3 py-1 text-xs font-bold rounded-lg border bg-blue-50 text-blue-700 border-blue-100">
                            EDITABLE
                        </span>
                    </div>

                    <h1 className="text-2xl font-bold text-gray-900 leading-tight">{details.name}</h1>
                    {details.description && (
                        <p className="text-gray-600 mt-2 text-sm">{details.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-4 text-sm text-gray-500">
                        <Calendar className="w-4 h-4" />
                        <span>Created: {formatDate(details.latestSnapshot?.createdAt)}</span>
                    </div>
                </div>

                <div className="p-6 space-y-6 flex-1">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white rounded-lg shadow-sm">
                                    <Package className="w-5 h-5 text-gray-600" />
                                </div>
                                <span className="text-sm font-medium text-gray-600">Total Orders</span>
                            </div>
                            <span className="text-xl font-bold text-gray-900">{details.orders.length}</span>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white rounded-lg shadow-sm">
                                    <CreditCard className="w-5 h-5 text-indigo-600" />
                                </div>
                                <span className="text-sm font-medium text-gray-600">Total Amount</span>
                            </div>
                            <div className="text-right">
                                <span className="text-xl font-bold text-indigo-600 block">
                                    {formatCurrency(displayTotalAmount)}
                                </span>
                                {details.latestSnapshot && Math.abs(displayTotalAmount - Number(details.latestSnapshot.result)) > 1 && (
                                    <span className={`text-xs ${displayTotalAmount > Number(details.latestSnapshot.result) ? 'text-green-600' : 'text-red-600'}`}>
                                        {displayTotalAmount > Number(details.latestSnapshot.result) ? '+' : ''}
                                        {formatCurrency(displayTotalAmount - Number(details.latestSnapshot.result))}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="pt-6 border-t border-gray-100 space-y-4">
                        <div className="bg-amber-50 rounded-lg p-3 flex items-start gap-2 border border-amber-100">
                            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                            <p className="text-xs text-amber-700">
                                Update rates in the list, then click Finalize to apply changes and lock this group.
                            </p>
                        </div>

                        <button
                            onClick={handleFinalize}
                            disabled={finalizing}
                            className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-gray-200 flex items-center justify-center gap-2"
                        >
                            {finalizing ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="w-4 h-4" /> Finalize Group
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* RIGHT COLUMN: Scrollable Order List */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-gray-50 scrollbar-hide">
                <div className="max-w-5xl mx-auto space-y-6 pb-20">
                    <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-gray-200 shadow-sm  top-0 z-20 backdrop-blur-md bg-white/95">
                        <h3 className="text-lg font-bold text-gray-800">Order Costs Breakdown</h3>
                        <span className="text-sm text-gray-500 font-medium bg-gray-100 px-3 py-1 rounded-full">
                            {details.orders.length} orders
                        </span>
                    </div>

                    <div className="space-y-4">
                        {details.orders.map((order) => {
                            const orderSnapshot = order.billing;
                            const isExpanded = expandedOrders.has(order.id);

                            // Calculate order total
                            let orderCurrentTotal = 0;
                            const orderHasEdits = !!draftInputs[order.id];

                            order.processes.forEach(p => {
                                p.runs.forEach(r => {
                                    const metrics = getRunBillingMetrics(r, p.name, order.quantity);
                                    const input = orderSnapshot?.inputs?.[r.id];
                                    const baseRate = metrics.ratePerPc;
                                    const rate = draftInputs[order.id]?.[r.id]?.new_rate ?? input?.new_rate ?? baseRate;
                                    const qty = input?.quantity ?? metrics.quantity;
                                    orderCurrentTotal += rate * qty;
                                });
                            });

                            // If no manual edits for this order, prefer the stored billing result
                            if (!orderHasEdits && orderSnapshot?.result) {
                                orderCurrentTotal = Number(orderSnapshot.result);
                            }

                            return (
                                <div
                                    key={order.id}
                                    className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-all hover:shadow-md"
                                >
                                    <div
                                        className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-gray-50/80 transition-colors"
                                        onClick={() => toggleOrderExpansion(order.id)}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div
                                                className={`p-2 rounded-lg shrink-0 ${order.status === 'BILLED' ? 'bg-purple-100 text-purple-600' : 'bg-blue-50 text-blue-600'}`}
                                            >
                                                <FileText className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h4 className="font-bold text-gray-900 text-lg">{order.code}</h4>
                                                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full border border-gray-200">
                                                        {order.quantity} units
                                                    </span>
                                                </div>
                                                <p className="text-sm text-gray-500 font-medium">{order.customer.name}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-6 justify-between sm:justify-end">
                                            <div className="text-right">
                                                <p className="text-lg font-bold text-gray-900">
                                                    {formatCurrency(orderCurrentTotal)}
                                                </p>
                                                <p className="text-xs text-gray-500">Total Billed</p>
                                            </div>

                                            <div
                                                className={`p-1.5 rounded-full transition-transform duration-200 ${isExpanded ? 'rotate-180 bg-gray-100' : 'hover:bg-gray-50'}`}
                                            >
                                                <ChevronDown className="w-5 h-5 text-gray-400" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Expanded Content */}
                                    {isExpanded && (
                                        <div className="border-t border-gray-100 bg-gray-50/50 animate-in slide-in-from-top-1 duration-200">
                                            <div className="divide-y divide-gray-100">
                                                {order.processes.map((process) => (
                                                    <div key={process.id} className="p-4">
                                                        <div className="flex items-center gap-2 mb-3">
                                                            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                                            <span className="font-semibold text-sm text-gray-700">
                                                                {process.name}
                                                            </span>
                                                        </div>
                                                        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                                                            {process.runs.map((run, idx) => {
                                                                // Get consistent metrics
                                                                const metrics = getRunBillingMetrics(run, process.name, order.quantity);
                                                                const input = orderSnapshot?.inputs?.[run.id] || {};

                                                                const baseRate = metrics.ratePerPc;
                                                                // Always prefer the effective rate per piece (baseRate) for display
                                                                // to ensure mathematical consistency (Rate * Qty = Amount).
                                                                const currentRate = baseRate;
                                                                // If input doesn't have quantity, we fallback to metrics.quantity
                                                                const qty = input.quantity ?? input.total_quantity ?? input['total_quantity'] ?? input['quantity'] ?? metrics.quantity;

                                                                const draftVal = draftInputs[order.id]?.[run.id]?.new_rate;
                                                                const displayRate =
                                                                    draftVal !== undefined ? draftVal : currentRate;
                                                                const displayTotal = displayRate * qty;
                                                                const isEdited =
                                                                    draftVal !== undefined && (Math.abs(draftVal - currentRate) > 0.01);

                                                                const values = run.values || {};
                                                                const items = parseJsonItems(values.items);
                                                                const isDTF = process.name === 'DTF' || process.name === 'Direct to Film (DTF)';

                                                                return (
                                                                    <div key={run.id} className={`${idx !== process.runs.length - 1 ? 'border-b border-gray-100' : ''}`}>
                                                                        <div className="p-3 flex items-center justify-between gap-4">
                                                                            <div className="flex-1 min-w-0">
                                                                                <p className="text-sm font-semibold text-gray-900 truncate">
                                                                                    {run.name}
                                                                                </p>
                                                                                <div className="flex items-center gap-2 mt-1">
                                                                                    <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded-md border border-gray-200 uppercase font-bold">
                                                                                        Qty: {qty}
                                                                                    </span>
                                                                                    {isDTF && values['Total Area'] && (
                                                                                        <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-md border border-blue-100 uppercase font-bold">
                                                                                            Area: {values['Total Area']}
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            </div>

                                                                            {/* RATES & TOTALS */}
                                                                            <div className="flex items-center gap-4 shrink-0">
                                                                                <div className="text-right">
                                                                                    <span className="text-[10px] uppercase tracking-wider text-gray-400 block mb-1">
                                                                                        Rate
                                                                                    </span>
                                                                                    <div className="flex items-center gap-1">
                                                                                        <div className="relative group/input">
                                                                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
                                                                                                ₹
                                                                                            </span>
                                                                                            <input
                                                                                                type="number"
                                                                                                step="0.00001"
                                                                                                className={`w-28 pl-5 pr-2 py-1.5 text-sm border rounded outline-none transition-all text-right font-medium
                                                                                                    ${isEdited ? 'border-amber-300 bg-amber-50 text-amber-900 ring-2 ring-amber-100' : 'border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-100'}
                                                                                                `}
                                                                                                value={displayRate}
                                                                                                onChange={(e) =>
                                                                                                    handleRateChange(order.id, run.id, e.target.value)
                                                                                                }
                                                                                                onFocus={(e) => e.target.select()}
                                                                                                readOnly={
                                                                                                    !hasPermission(Permission.BILLINGS_UPDATE)
                                                                                                }
                                                                                            />
                                                                                        </div>
                                                                                    </div>
                                                                                </div>

                                                                                <div className="text-right min-w-[100px]">
                                                                                    <span className="text-[10px] uppercase tracking-wider text-gray-400 block mb-1">
                                                                                        Amount
                                                                                    </span>
                                                                                    <span className="text-sm font-bold text-gray-900 block py-1.5">
                                                                                        {formatCurrency(displayTotal)}
                                                                                    </span>
                                                                                    {isEdited && Math.abs(displayTotal - currentRate * qty) > 0.01 && (
                                                                                        <span
                                                                                            className={`text-[10px] block font-bold ${displayTotal > currentRate * qty ? 'text-green-600' : 'text-red-600'}`}
                                                                                        >
                                                                                            {displayTotal > currentRate * qty ? '+' : ''}
                                                                                            {formatCurrency(displayTotal - currentRate * qty)}
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        </div>

                                                                        {/* Items Table for specific processes */}
                                                                        {items.length > 0 && (
                                                                            <div className="px-3 pb-3">
                                                                                <div className="bg-gray-50/50 rounded-lg border border-gray-100 overflow-hidden">
                                                                                    <table className="w-full text-[10px]">
                                                                                        <thead className="bg-gray-100/50 text-gray-500 uppercase">
                                                                                            <tr>
                                                                                                <th className="px-2 py-1 text-left">Particulars</th>
                                                                                                {process.name === 'Sublimation' ? (
                                                                                                    <>
                                                                                                        <th className="px-2 py-1 text-right">Size</th>
                                                                                                        <th className="px-2 py-1 text-right">W/H</th>
                                                                                                        <th className="px-2 py-1 text-right">Q1-Q4</th>
                                                                                                        <th className="px-2 py-1 text-right">Sum</th>
                                                                                                    </>
                                                                                                ) : (
                                                                                                    <>
                                                                                                        <th className="px-2 py-1 text-right">
                                                                                                            {process.name === 'Allover Sublimation' ? 'H/Qty' : process.name === 'Diamond' ? 'Size' : process.name === 'Plotter' ? 'W/H' : 'Layouts'}
                                                                                                        </th>
                                                                                                        <th className="px-2 py-1 text-right">
                                                                                                            {process.name === 'Allover Sublimation' || process.name === 'Diamond' || process.name === 'Plotter' || process.name === 'Positive' ? 'Qty' : 'Area'}
                                                                                                        </th>
                                                                                                    </>
                                                                                                )}
                                                                                                <th className="px-2 py-1 text-right">Row Total</th>
                                                                                            </tr>
                                                                                        </thead>
                                                                                        <tbody className="divide-y divide-gray-100">
                                                                                            {items.map((item: any, idx: number) => (
                                                                                                <tr key={idx}>
                                                                                                    <td className="px-2 py-1 text-gray-600">
                                                                                                        {item.particulars || item.design || item.designSizes || item.description || item.fileSizes || '-'}
                                                                                                    </td>
                                                                                                    {process.name === 'Sublimation' ? (
                                                                                                        <>
                                                                                                            <td className="px-2 py-1 text-right text-gray-600">{item.size || '-'}</td>
                                                                                                            <td className="px-2 py-1 text-right text-gray-600">{item.width}x{item.height}</td>
                                                                                                            <td className="px-2 py-1 text-right text-gray-600">
                                                                                                                {Array.isArray(item.quantities) ? item.quantities.join('|') : '-'}
                                                                                                            </td>
                                                                                                            <td className="px-2 py-1 text-right text-gray-600">{item.sum || item.quantity || 0}</td>
                                                                                                        </>
                                                                                                    ) : (
                                                                                                        <>
                                                                                                            <td className="px-2 py-1 text-right text-gray-600">
                                                                                                                {item.numberOfLayouts || item.height || item.fSize || (item.width && item.height ? `${item.width}x${item.height}` : null) || '-'}
                                                                                                            </td>
                                                                                                            <td className="px-2 py-1 text-right text-gray-600">
                                                                                                                {item.area || item.quantity || '-'}
                                                                                                            </td>
                                                                                                        </>
                                                                                                    )}
                                                                                                    <td className="px-2 py-1 text-right font-medium text-gray-800">
                                                                                                        {formatCurrency(item.rowTotal || item.amount || item.total || 0)}
                                                                                                    </td>
                                                                                                </tr>
                                                                                            ))}
                                                                                        </tbody>
                                                                                    </table>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

// Inline Helper for API request until service is updated
async function finalizeBillingGroupWithInputs(payload: any) {
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;
    const response = await fetch(`${API_BASE_URL}/billing/finalize/group`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            // Include auth if needed by adding credentials: include
        },
        body: JSON.stringify(payload),
        credentials: 'include',
    });

    if (!response.ok) {
        throw new Error('Failed to finalize group');
    }
    return response.json();
}

export default withAuth(BillingContextDetailPage, { permission: Permission.BILLINGS_VIEW });
