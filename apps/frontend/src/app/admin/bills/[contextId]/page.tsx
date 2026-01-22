"use client";

import { BillingContextDetails } from "@/domain/model/billing.model";
import { getBillingContextById } from "@/services/billing.service";
import {
    AlertCircle,
    ArrowLeft,
    Calendar,
    CheckCircle2,
    ChevronDown,
    CreditCard,
    FileText,
    Loader2,
    Package
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function BillingContextDetailPage() {
    const { contextId } = useParams<{ contextId: string }>();
    // Ensure contextId is always a string to satisfy API types
    const safeContextId = Array.isArray(contextId) ? contextId[0] : contextId;

    const router = useRouter();
    const [details, setDetails] = useState<BillingContextDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [finalizing, setFinalizing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Track editable inputs: { orderId: { runId: { new_rate: number } } }
    const [draftInputs, setDraftInputs] = useState<Record<string, Record<string, { new_rate: number }>>>({});

    // Expanded state for order cards
    const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());

    const fetchDetails = async () => {
        if (!safeContextId) return;
        setLoading(true);
        try {
            const data = await getBillingContextById(safeContextId);
            setDetails(data);
        } catch (error) {
            console.error("Failed to fetch billing context details:", error);
            setError("Failed to load billing group details");
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

        setDraftInputs(prev => ({
            ...prev,
            [orderId]: {
                ...(prev[orderId] || {}),
                [runId]: { new_rate: rate }
            }
        }));
    };



    const handleFinalize = async () => {
        if (!safeContextId) return;
        if (!confirm("Are you sure you want to finalize this billing group? This will apply rates to all orders.")) {
            return;
        }

        setFinalizing(true);
        try {
            const payload = {
                billingContextId: safeContextId,
                inputs: draftInputs
            };

            await finalizeBillingGroupWithInputs(payload);

            // Clear draft inputs after successful finalization
            setDraftInputs({});

            // Refresh the page data to show updated state
            await fetchDetails();

            alert("Billing group finalized successfully!");
        } catch (error) {
            console.error("Failed to finalize group:", error);
            alert("Failed to finalize billing group");
        } finally {
            setFinalizing(false);
        }
    };

    const toggleOrderExpansion = (orderId: string) => {
        setExpandedOrders(prev => {
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
            maximumFractionDigits: 0
        }).format(Number(amount));
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
                <p className="text-lg font-bold">{error || "Billing Group Not Found"}</p>
                <Link href="/admin/bills" className="mt-4 text-blue-600 hover:underline">
                    Return to Bills
                </Link>
            </div>
        );
    }

    // isDraft condition removed - editing always enabled

    // Calculate total amount dynamically based on draft inputs
    // This is optional for 'perfection' but good for UX. 
    // We can iterate orders -> runs -> check draft input OR snapshot input.
    let displayTotalAmount = 0;
    if (details) {
        details.orders.forEach(order => {
            // If order has billing calc result, start with that components?
            // Actually re-calculating whole group total is complex without backend logic.
            // We can just rely on the server validation or sum up what we have locally.
            // Local sum:
            const snapshotInputs = order.billing?.inputs || {};

            let orderTotal = 0;
            order.processes.forEach(p => {
                p.runs.forEach(r => {
                    // Check draft
                    const draft = draftInputs[order.id]?.[r.id];
                    // Check snapshot
                    const snap = snapshotInputs[r.id]; // billing inputs are flattened usually? or nested?
                    // Based on sample data: inputs: { runId: { new_rate: x, quantity: y } }

                    let rate = 0;
                    let qty = 0;

                    if (snap) {
                        rate = snap.new_rate ?? snap['new_rate'] ?? 0;
                        qty = snap.quantity ?? snap['quantity'] ?? 0;
                    }

                    // Override rate if draft exists
                    if (draft?.new_rate !== undefined) {
                        rate = draft.new_rate;
                    }
                    // If no snap qty, maybe use run val? but difficult to get here easily without deeper lookup
                    // Assuming snap has it if invoiced. If not invoiced, we might default to run values
                    // Since we are in 'billing context', snapshots should exist or be created.
                    // The modal logic had fallback. Here we assume details.inputs exist.

                    orderTotal += (rate * qty);
                });
            });
            displayTotalAmount += orderTotal;
        });
    }
    // Fallback if calculation is zero (e.g. initial load without full traversal logic matching)
    // or just show original result if no edits? 
    // Let's just show details.latestSnapshot.result for now to avoid complexity bugs 
    // OR we ideally show the 'Estimated New Total' if changed.
    // For simplicity of this task step, I'll stick to displaying the static total 
    // unless I'm confident in the math. The user asked for "update the new rate option", 
    // not necessarily dynamic full client-side recalc (though nice). 
    // I'll show the server-provided total for now to be safe.

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden">
            {/* LEFT COLUMN: Fixed Sidebar */}
            <div className="w-[400px] shrink-0 border-r border-gray-200 bg-white shadow-lg overflow-y-auto z-10 flex flex-col">
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
                            <span className="text-xl font-bold text-gray-900">{details.ordersCount}</span>
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
                                    {details.latestSnapshot ? formatCurrency(details.latestSnapshot.result) : '-'}
                                </span>
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
            <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-gray-50">
                <div className="max-w-5xl mx-auto space-y-6 pb-20">
                    <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-gray-200 shadow-sm sticky top-0 z-20 backdrop-blur-md bg-white/95">
                        <h3 className="text-lg font-bold text-gray-800">Order Costs Breakdown</h3>
                        <span className="text-sm text-gray-500 font-medium bg-gray-100 px-3 py-1 rounded-full">
                            {details.orders.length} orders
                        </span>
                    </div>

                    <div className="space-y-4">
                        {details.orders.map((order) => {
                            const orderSnapshot = order.billing;
                            const isExpanded = expandedOrders.has(order.id);

                            return (
                                <div key={order.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-all hover:shadow-md">
                                    <div
                                        className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-gray-50/80 transition-colors"
                                        onClick={() => toggleOrderExpansion(order.id)}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`p-2 rounded-lg shrink-0 ${order.status === 'BILLED' ? 'bg-purple-100 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
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
                                                    {orderSnapshot ? formatCurrency(orderSnapshot.result) : '-'}
                                                </p>
                                                <p className="text-xs text-gray-500">Total Billed</p>
                                            </div>

                                            <div className={`p-1.5 rounded-full transition-transform duration-200 ${isExpanded ? 'rotate-180 bg-gray-100' : 'hover:bg-gray-50'}`}>
                                                <ChevronDown className="w-5 h-5 text-gray-400" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Expanded Content */}
                                    {isExpanded && (
                                        <div className="border-t border-gray-100 bg-gray-50/50 animate-in slide-in-from-top-1 duration-200">
                                            {orderSnapshot ? (
                                                <div className="divide-y divide-gray-100">
                                                    {order.processes.map(process => (
                                                        <div key={process.id} className="p-4">
                                                            <div className="flex items-center gap-2 mb-3">
                                                                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                                                <span className="font-semibold text-sm text-gray-700">{process.name}</span>
                                                            </div>
                                                            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                                                                {process.runs.map((run, idx) => {
                                                                    const input = orderSnapshot.inputs?.[run.id] || {};
                                                                    const currentRate = input.new_rate ?? input['new_rate'] ?? 0;
                                                                    const qty = input.quantity ?? input['quantity'] ?? 0;

                                                                    const draftVal = draftInputs[order.id]?.[run.id]?.new_rate;
                                                                    const displayRate = draftVal !== undefined ? draftVal : currentRate;
                                                                    const displayTotal = displayRate * qty;
                                                                    const isEdited = draftVal !== undefined && draftVal !== currentRate;

                                                                    return (
                                                                        <div key={run.id} className={`p-3 flex items-center justify-between gap-4 ${idx !== process.runs.length - 1 ? 'border-b border-gray-100' : ''}`}>
                                                                            <div className="min-w-0 flex-1">
                                                                                <p className="text-sm font-medium text-gray-800 truncate">{run.name}</p>
                                                                                <p className="text-xs text-gray-500">{qty} units</p>
                                                                            </div>

                                                                            <div className="flex items-center gap-4">
                                                                                <div className="text-right">
                                                                                    <span className="text-[10px] uppercase tracking-wider text-gray-400 block mb-1">Rate</span>
                                                                                    <div className="flex items-center gap-1">
                                                                                        <div className="relative group/input">
                                                                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">₹</span>
                                                                                            <input
                                                                                                type="number"
                                                                                                className={`w-24 pl-5 pr-2 py-1.5 text-sm border rounded outline-none transition-all text-right font-medium
                                                                                                    ${isEdited ? 'border-amber-300 bg-amber-50 text-amber-900 ring-2 ring-amber-100' : 'border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-100'}
                                                                                                `}
                                                                                                value={displayRate}
                                                                                                onChange={(e) => handleRateChange(order.id, run.id, e.target.value)}
                                                                                                onFocus={(e) => e.target.select()}
                                                                                            />
                                                                                        </div>
                                                                                        <button
                                                                                            className={`p-1.5 rounded-md transition-colors ${isEdited ? 'text-amber-600 bg-amber-100 hover:bg-amber-200' : 'text-gray-300 bg-gray-100 hover:bg-gray-200'}`}
                                                                                            title="Update Rate"
                                                                                        >
                                                                                            <CheckCircle2 className="w-4 h-4" />
                                                                                        </button>
                                                                                    </div>
                                                                                </div>

                                                                                <div className="text-right min-w-[80px]">
                                                                                    <span className="text-[10px] uppercase tracking-wider text-gray-400 block mb-1">Amount</span>
                                                                                    <span className="text-sm font-bold text-gray-900 block py-1.5">
                                                                                        {formatCurrency(displayTotal)}
                                                                                    </span>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="p-8 text-center text-gray-500 italic">
                                                    No billing data available for this order.
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div >
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
        credentials: 'include'
    });

    if (!response.ok) {
        throw new Error('Failed to finalize group');
    }
    return response.json();
}
