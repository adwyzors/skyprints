'use client';
//apps\frontend\src\components\modals\BillingModal.tsx
import { useAuth } from '@/auth/AuthProvider';
import { Permission } from '@/auth/permissions';
import { Order } from '@/domain/model/order.model';
import { apiRequest } from '@/services/api.service';
import { getOrderById } from '@/services/orders.service';
import {
    Calculator,
    ChevronDown,
    Clock,
    Edit2,
    FileText,
    IndianRupee,
    Loader2,
    Package,
    X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import EditOrderModal from './EditOrderModal';

interface Props {
    orderId: string;
    onClose: () => void;
    onSuccess?: () => void;
}

// Track billing rates for each run
interface BillingRates {
    [runId: string]: number;
}

export default function BillingModal({ orderId, onClose, onSuccess }: Props) {
    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);
    const [billingRates, setBillingRates] = useState<BillingRates>({});
    const [expandedRuns, setExpandedRuns] = useState<Set<string>>(new Set());
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    // Fetch order details when modal opens
    useEffect(() => {
        const fetchOrder = async () => {
            setLoading(true);
            try {
                const fetchedOrder = await getOrderById(orderId);
                setOrder(fetchedOrder);
            } catch (err) {
                console.error('Error fetching order:', err);
                setError('Failed to load order details');
            } finally {
                setLoading(false);
            }
        };

        fetchOrder();
    }, [orderId]);

    const refreshOrder = async () => {
        setLoading(true);
        try {
            const fetchedOrder = await getOrderById(orderId);
            setOrder(fetchedOrder);
        } catch (err) {
            console.error('Error fetching order:', err);
        } finally {
            setLoading(false);
        }
    };

    const toggleRunExpansion = (runId: string) => {
        const newExpanded = new Set(expandedRuns);
        if (newExpanded.has(runId)) {
            newExpanded.delete(runId);
        } else {
            newExpanded.add(runId);
        }
        setExpandedRuns(newExpanded);
    };

    const updateRunBillingRate = (runId: string, rate: number) => {
        setBillingRates((prev) => ({
            ...prev,
            [runId]: rate,
        }));
    };

    const getBillingRate = (runId: string, originalRate: number): number => {
        return billingRates[runId] !== undefined ? billingRates[runId] : originalRate;
    };

    const getRunBillingMetrics = (run: any, processName: string) => {
        const values = (run.values || {}) as any;
        let quantity = 0;
        let amount = 0;

        // Parse items if stringified
        const items = Array.isArray(values?.items)
            ? values.items
            : typeof values?.items === 'string'
                ? (() => {
                    try {
                        return JSON.parse(values.items);
                    } catch {
                        return [];
                    }
                })()
                : [];

        switch (processName) {
            case 'Allover Sublimation':
                quantity = items.reduce((sum: number, i: any) => sum + (Number(i.quantity) || 0), 0);
                amount = Number(values['Total Amount']) || Number(values['total_amount']) || 0;
                break;
            case 'Sublimation':
                quantity = items.reduce((sum: number, i: any) => {
                    const rowSum = Array.isArray(i.quantities)
                        ? i.quantities.reduce((rs: number, q: any) => rs + (Number(q) || 0), 0)
                        : 0;
                    return sum + rowSum;
                }, 0);
                amount = Number(values['totalAmount']) || Number(values['total_amount']) || 0;
                break;
            case 'Plotter':
                quantity = items.reduce((sum: number, i: any) => sum + (Number(i.quantity) || 0), 0);
                amount = Number(values['Total Amount']) || Number(values['total_amount']) || 0;
                break;
            case 'Positive':
                quantity = items.reduce((sum: number, i: any) => sum + (Number(i.quantity) || 0), 0);
                amount = Number(values['Total Amount']) || Number(values['total_amount']) || 0;
                break;
            case 'Screen Printing':
                quantity = Number(values['Total Quantity']) || Number(values['total_quantity']) || 0;
                amount = Number(values['Estimated Amount']) || Number(values['total_amount']) || 0;
                break;
            case 'Embellishment':
                quantity = Number(values['Total Quantity']) || Number(values['total_quantity']) || 0;
                amount = Number(values['Final Total']) || Number(values['Total Amount']) || Number(values['total_amount']) || 0;
                break;
            default:
                quantity = Number(values['Total Quantity']) || Number(values['totalQuantity']) || Number(values['total_quantity']) || (values?.['Quantity'] as number) || 0;
                amount = Number(values['Total Amount']) || Number(values['totalAmount']) || Number(values['total_amount']) || Number(values['Estimated Amount']) || 0;
        }

        const ratePerPc = quantity > 0 ? amount / quantity : 0;
        return { quantity, amount, ratePerPc };
    };
    const { hasPermission } = useAuth();

    // Calculate totals
    const calculateTotals = () => {
        if (!order) return { totalAmount: 0, originalTotal: 0 };

        let totalAmount = 0;
        let originalTotal = 0;

        order.processes.forEach((process) => {
            process.runs.forEach((run) => {
                const metrics = getRunBillingMetrics(run, process.name);
                const quantity = metrics.quantity;
                const estimatedRate = metrics.ratePerPc;
                const billingRate = getBillingRate(run.id, estimatedRate);

                originalTotal += quantity * estimatedRate;
                totalAmount += quantity * billingRate;
            });
        });

        return { totalAmount, originalTotal };
    };

    const { totalAmount, originalTotal } = calculateTotals();

    // Build the API payload
    const buildPayload = (): { orderId: string; inputs: Record<string, { new_rate: number }> } => {
        const inputs: Record<string, { new_rate: number }> = {};

        if (!order) return { orderId: '', inputs };

        order.processes.forEach((process) => {
            process.runs.forEach((run) => {
                const metrics = getRunBillingMetrics(run, process.name);
                const estimatedRate = metrics.ratePerPc;
                const billingRate = getBillingRate(run.id, estimatedRate);
                inputs[run.id] = { new_rate: billingRate };
            });
        });

        return { orderId: order.id, inputs };
    };

    const finalizeBilling = async () => {
        if (!order) return;

        setSubmitting(true);
        setError(null);

        try {
            const payload = buildPayload();
            // The API returns the created snapshot object, not { success: boolean }
            await apiRequest<any>(`/billing/finalize/order`, {
                method: 'POST',
                body: JSON.stringify(payload),
            });

            // If apiRequest didn't throw, it was successful
            onSuccess?.();
            onClose();
        } catch (err) {
            console.error('Billing error:', err);
            setError(err instanceof Error ? err.message : 'Failed to finalize billing');
        } finally {
            setSubmitting(false);
        }
    };

    // Check if process is supported for customized billing
    const isCustomBillingSupported = (processName: string) =>
        [
            'Screen Printing',
            'Embellishment',
            'Allover Sublimation',
            'Sublimation',
            'Plotter',
            'Positive',
        ].includes(processName);

    const isEmbellishment = (processName: string) => processName === 'Embellishment';

    const parseDTFItems = (items: unknown): any[] => {
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

    // Loading state
    if (loading) {
        return (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl p-8 flex flex-col items-center gap-4">
                    <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                    <span className="text-gray-600">Loading order details...</span>
                </div>
            </div>
        );
    }

    // Error state or no order
    if (!order) {
        return (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl p-8 text-center max-w-md">
                    <div className="text-red-500 mb-4">Failed to load order</div>
                    <button onClick={onClose} className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200">
                        Close
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-7xl h-[90vh] rounded-2xl flex overflow-hidden shadow-2xl">
                {/* LEFT — ORDER SUMMARY */}
                <div className="w-96 shrink-0 border-r border-gray-200 bg-gradient-to-b from-gray-50 to-white p-6 flex flex-col">
                    <div className="flex-1 overflow-y-auto">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-800 mb-1">{order.code}</h2>
                                <p className="text-gray-600">Billing Generation</p>
                            </div>
                            <div className="flex items-center gap-2">
                                {hasPermission(Permission.ORDERS_UPDATE) && (
                                    <button
                                        onClick={() => setIsEditModalOpen(true)}
                                        disabled={submitting}
                                        className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 bg-white border border-transparent hover:border-blue-100"
                                        title="Edit Order"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                        <span className="text-sm font-medium hidden sm:inline">Edit</span>
                                    </button>
                                )}
                                <button
                                    onClick={onClose}
                                    disabled={submitting}
                                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                                >
                                    <X className="w-5 h-5 text-gray-500" />
                                </button>
                            </div>
                        </div>

                        {/* ORDER INFO */}
                        <div className="space-y-4 mb-8">
                            <div className="bg-white border border-gray-200 rounded-xl p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-2 h-2 bg-blue-500 rounded-full" />
                                    <span className="font-medium text-gray-700">Customer Information</span>
                                </div>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Name:</span>
                                        <span className="font-medium">{order.customer?.name}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Code:</span>
                                        <span className="font-medium">{order.customer?.code}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Order Quantity:</span>
                                        <span className="font-medium">{order.quantity} units</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* AMOUNT SUMMARY */}
                        <div className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-5">
                            <div className="flex items-center gap-2 mb-3">
                                <Calculator className="w-6 h-6 text-blue-600" />
                                <span className="font-medium text-gray-800">Amount Summary</span>
                            </div>

                            <div className="space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">Original Estimate:</span>
                                    <span className="font-medium">₹{originalTotal.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">Billing Adjustments:</span>
                                    <span
                                        className={`font-medium ${totalAmount > originalTotal ? 'text-green-600' : totalAmount < originalTotal ? 'text-red-600' : 'text-gray-600'}`}
                                    >
                                        ₹{(totalAmount - originalTotal).toLocaleString()}
                                    </span>
                                </div>
                                <div className="pt-3 border-t border-blue-200">
                                    <div className="flex justify-between">
                                        <span className="font-bold text-gray-800">Final Amount:</span>
                                        <span className="text-2xl font-bold text-gray-800">
                                            ₹{totalAmount.toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                                {error}
                            </div>
                        )}
                    </div>

                    {/* Close Button Mobile - hidden on desktop as we have X top right */}
                    <div className="md:hidden pt-4 border-t border-gray-200 mt-4">
                        <button
                            onClick={onClose}
                            disabled={submitting}
                            className="w-full border border-gray-300 px-4 py-2.5 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                        >
                            Cancel
                        </button>
                    </div>
                </div>

                {/* RIGHT — BILLING DETAILS */}
                <div className="flex-1 min-w-0 flex flex-col h-full bg-white">
                    {/* SCROLLABLE CONTENT */}
                    <div className="flex-1 overflow-y-auto p-6">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-800">Billing Details</h2>
                                <p className="text-gray-600">
                                    Enter billing rates for each run (separate from production rates)
                                </p>
                            </div>
                        </div>

                        {/* PROCESSES LIST */}
                        <div className="space-y-6">
                            {order.processes.map((process) => (
                                <div key={process.id} className="border border-gray-200 rounded-xl overflow-hidden">
                                    {/* PROCESS HEADER */}
                                    <div className="bg-gradient-to-r from-gray-50 to-white px-5 py-4 border-b border-gray-200">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                                                    <Package className="w-4 h-4 text-blue-600" />
                                                </div>
                                                <div>
                                                    <h3 className="font-semibold text-lg text-gray-800">{process.name}</h3>
                                                    <div className="flex items-center gap-3 mt-1 text-sm text-gray-600">
                                                        <span>
                                                            {process.runs.length} run{process.runs.length !== 1 ? 's' : ''}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* CONDITIONAL RENDERING BASED ON PROCESS TYPE */}
                                    {isCustomBillingSupported(process.name) ? (
                                        // SUPPORTED PROCESSES - Show billing rates input
                                        <div className="divide-y divide-gray-100">
                                            {process.runs.map((run) => {
                                                const isExpanded = expandedRuns.has(run.id);

                                                // Use our helper to get consistent metrics
                                                const metrics = getRunBillingMetrics(run, process.name);
                                                const quantity = metrics.quantity;
                                                const estimatedRate = metrics.ratePerPc;

                                                const billingRate = getBillingRate(run.id, estimatedRate);
                                                const originalRunTotal = quantity * estimatedRate;
                                                const billingTotal = quantity * billingRate;
                                                const rateDifference = billingRate - estimatedRate;

                                                return (
                                                    <div key={run.id} className="bg-white">
                                                        {/* RUN HEADER */}
                                                        <div className="px-5 py-4">
                                                            <div className="flex items-center justify-between">
                                                                <div
                                                                    className="flex items-center gap-3 cursor-pointer"
                                                                    onClick={() => toggleRunExpansion(run.id)}
                                                                >
                                                                    <ChevronDown
                                                                        className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                                                    />
                                                                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                                                                        <span className="font-bold text-gray-700">{run.runNumber}</span>
                                                                    </div>
                                                                    <div>
                                                                        <div className="font-medium text-gray-800">
                                                                            Run {run.runNumber} - {run.displayName}
                                                                        </div>
                                                                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                                                            <span className="text-blue-600 font-medium">Rate: ₹{estimatedRate.toFixed(2)}/pc</span>
                                                                            <span>•</span>
                                                                            <span>Qty: {quantity}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div className="flex items-center gap-6">
                                                                    {/* BILLING TOTAL */}
                                                                    <div className="text-right">
                                                                        <div className="text-[10px] uppercase text-gray-500 mb-1">Billing Total</div>
                                                                        <div
                                                                            className={`text-lg font-bold ${billingTotal > 0 ? 'text-green-700' : 'text-gray-500'}`}
                                                                        >
                                                                            ₹{billingTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                        </div>
                                                                        {rateDifference !== 0 && (
                                                                            <div
                                                                                className={`text-xs font-medium ${rateDifference > 0 ? 'text-green-600' : 'text-red-600'}`}
                                                                            >
                                                                                {rateDifference > 0 ? '+' : ''}
                                                                                {rateDifference.toFixed(2)}/pc
                                                                            </div>
                                                                        )}
                                                                    </div>

                                                                    {/* BILLING RATE INPUT */}
                                                                    <div className="w-48">
                                                                        <div className="relative">
                                                                            <IndianRupee className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                                                            <input
                                                                                type="number"
                                                                                min="0"
                                                                                step="0.01"
                                                                                placeholder="0.00"
                                                                                value={
                                                                                    billingRates[run.id] !== undefined
                                                                                        ? billingRates[run.id]
                                                                                        : estimatedRate.toFixed(2)
                                                                                }
                                                                                onChange={(e) => {
                                                                                    const value = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                                                                    updateRunBillingRate(run.id, value);
                                                                                }}
                                                                                disabled={submitting}
                                                                                readOnly={!hasPermission(Permission.BILLINGS_UPDATE)}
                                                                                className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 font-semibold"
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* EXPANDED DETAILS */}
                                                            {isExpanded && (
                                                                <div className="mt-4 pt-4 border-t border-gray-100">
                                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                        {/* PREDICTION CARD */}
                                                                        <div className="bg-amber-50 border border-amber-100 rounded-lg p-4">
                                                                            <div className="flex items-center gap-2 mb-3">
                                                                                <Calculator className="w-4 h-4 text-amber-600" />
                                                                                <span className="font-medium text-amber-800">
                                                                                    Billing Prediction
                                                                                </span>
                                                                            </div>
                                                                            <div className="space-y-3">
                                                                                <div className="flex justify-between text-sm">
                                                                                    <span className="text-amber-700">New Final Total:</span>
                                                                                    <span className="font-black text-amber-900 text-lg">
                                                                                        ₹{billingTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                                    </span>
                                                                                </div>
                                                                                <div className="flex justify-between text-xs text-amber-600">
                                                                                    <span>Calculation:</span>
                                                                                    <span>{quantity} units × ₹{billingRate.toFixed(2)}</span>
                                                                                </div>
                                                                            </div>
                                                                        </div>

                                                                        {/* COMPARISON CARD */}
                                                                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                                                                            <div className="flex items-center gap-2 mb-3">
                                                                                <FileText className="w-4 h-4 text-blue-600" />
                                                                                <span className="font-medium text-gray-700">
                                                                                    Rate Comparison
                                                                                </span>
                                                                            </div>
                                                                            <div className="space-y-2">
                                                                                <div className="flex justify-between text-xs">
                                                                                    <span className="text-gray-500">Original Rate:</span>
                                                                                    <span className="font-medium">₹{estimatedRate.toFixed(2)}/pc</span>
                                                                                </div>
                                                                                <div className="flex justify-between text-xs">
                                                                                    <span className="text-gray-500">New Rate:</span>
                                                                                    <span className="font-bold text-blue-700">
                                                                                        ₹{billingRate.toFixed(2)}/pc
                                                                                    </span>
                                                                                </div>
                                                                                <div className="pt-2 border-t border-gray-200 flex justify-between text-sm">
                                                                                    <span className="text-gray-700 font-medium">Difference:</span>
                                                                                    <span
                                                                                        className={`font-bold ${rateDifference > 0 ? 'text-green-600' : rateDifference < 0 ? 'text-red-600' : 'text-gray-500'}`}
                                                                                    >
                                                                                        {rateDifference > 0 ? '+' : ''}₹{rateDifference.toFixed(2)}/pc
                                                                                    </span>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    {/* Run Values Overview */}
                                                                    <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-4">
                                                                        <div className="text-[10px] uppercase font-bold text-gray-500 mb-3">Run Values Overview</div>
                                                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                                                                            {Object.entries(run.values || {})
                                                                                .filter(
                                                                                    ([key]) =>
                                                                                        ![
                                                                                            'items',
                                                                                            'images',
                                                                                            'Images',
                                                                                        ].includes(key),
                                                                                )
                                                                                .map(([key, value]) => (
                                                                                    <div key={key}>
                                                                                        <span className="text-gray-500 block mb-0.5 capitalize">
                                                                                            {key.replace(/([A-Z_])/g, ' $1').replace(/_/g, ' ')}:
                                                                                        </span>
                                                                                        <span className="font-medium text-gray-800">
                                                                                            {typeof value === 'number' && (key.toLowerCase().includes('amount') || key.toLowerCase().includes('total') || key.toLowerCase().includes('rate'))
                                                                                                ? `₹${value.toFixed(2)}`
                                                                                                : String(value)}
                                                                                        </span>
                                                                                    </div>
                                                                                ))}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : process.name === 'DTF' ? (
                                        <div className="divide-y divide-gray-100">
                                            {process.runs.map((run) => {
                                                const values = run.values || {};
                                                const items = parseDTFItems(values.items);

                                                return (
                                                    <div key={run.id} className="bg-white px-5 py-4">
                                                        {/* HEADER */}
                                                        <div className="flex items-center justify-between mb-4">
                                                            <div>
                                                                <div className="font-medium text-gray-800">
                                                                    Run {run.runNumber} – {run.displayName}
                                                                </div>
                                                                <div className="text-xs text-gray-500">
                                                                    Status: {run.lifecycleStatus}
                                                                </div>
                                                            </div>

                                                            <div className="text-right">
                                                                <div className="text-sm text-gray-600">Actual Total</div>
                                                                <div className="text-lg font-bold text-green-700">
                                                                    ₹{Number(values['Actual Total'] || 0).toLocaleString()}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* SUMMARY */}
                                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                                                                <div className="text-xs text-gray-500">Total Area</div>
                                                                <div className="font-bold text-gray-800">
                                                                    {Number(values['Total Area'] || 0).toLocaleString()}
                                                                </div>
                                                            </div>

                                                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                                                                <div className="text-xs text-gray-500">Total Layouts</div>
                                                                <div className="font-bold text-gray-800">
                                                                    {Number(values['Total Layouts'] || 0)}
                                                                </div>
                                                            </div>

                                                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                                                                <div className="text-xs text-gray-500">Per PC Cost</div>
                                                                <div className="font-bold text-gray-800">
                                                                    ₹{Number(values['Per PC Cost'] || 0).toLocaleString()}
                                                                </div>
                                                            </div>

                                                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                                                                <div className="text-xs text-gray-500">Efficiency %</div>
                                                                <div className="font-bold text-gray-800">
                                                                    {Number(values['Efficiency %'] || 0)}%
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* ITEMS TABLE */}
                                                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                                                            <table className="w-full text-sm">
                                                                <thead className="bg-gray-50 text-gray-600">
                                                                    <tr>
                                                                        <th className="px-3 py-2 text-left">Particulars</th>
                                                                        <th className="px-3 py-2 text-right">Layouts</th>
                                                                        <th className="px-3 py-2 text-right">Area</th>
                                                                        <th className="px-3 py-2 text-right">Row Total</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {items.map((item, idx) => (
                                                                        <tr key={idx} className="border-t">
                                                                            <td className="px-3 py-2">{item.particulars}</td>
                                                                            <td className="px-3 py-2 text-right">
                                                                                {item.numberOfLayouts}
                                                                            </td>
                                                                            <td className="px-3 py-2 text-right">{item.area}</td>
                                                                            <td className="px-3 py-2 text-right font-medium">
                                                                                ₹{Number(item.rowTotal || 0).toLocaleString()}
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        // OTHER PROCESSES - Coming Soon
                                        <div className="p-8 text-center">
                                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                                <Clock className="w-8 h-8 text-gray-400" />
                                            </div>
                                            <h4 className="text-lg font-semibold text-gray-700 mb-2">Coming Soon</h4>
                                            <p className="text-gray-500 text-sm max-w-md mx-auto">
                                                Billing configuration for {process.name} is not yet available. This feature
                                                will be added in a future update.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ACTION BUTTONS BUTTONS STICKY FOOTER */}
                    <div className="shrink-0 p-6 border-t border-gray-200 bg-white">
                        <div className="flex items-center justify-between">
                            <div className="text-sm text-gray-600">
                                <div className="flex items-center gap-2 mb-1">
                                    <IndianRupee className="w-4 h-4 text-green-500" />
                                    <span>Billing rates are stored separately and won't affect production rates</span>
                                </div>
                                <p>
                                    Once finalized, the order status will change to "BILLED" and moved to completed
                                    orders.
                                </p>
                            </div>

                            <div className="flex items-center gap-3">
                                <button
                                    onClick={onClose}
                                    disabled={submitting}
                                    className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={finalizeBilling}
                                    disabled={submitting}
                                    className={`px-8 py-3 font-medium rounded-xl transition-all flex items-center gap-3 ${!submitting
                                        ? 'bg-gradient-to-r from-green-600 to-green-700 text-white hover:from-green-700 hover:to-green-800 shadow-lg hover:shadow-xl'
                                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                        }`}
                                >
                                    {submitting ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            <span>Processing...</span>
                                        </>
                                    ) : (
                                        <>
                                            <IndianRupee className="w-5 h-5" />
                                            <div className="text-left">
                                                <div className="font-bold">Finalize Billing</div>
                                                <div className="text-xs opacity-90">₹{totalAmount.toLocaleString()}</div>
                                            </div>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {order && (
                    <EditOrderModal
                        open={isEditModalOpen}
                        onClose={() => setIsEditModalOpen(false)}
                        onSuccess={refreshOrder}
                        order={order}
                    />
                )}
            </div>
        </div>
    );
}
