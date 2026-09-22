'use client';

import { getRunById, transitionLifeCycle } from '@/services/run.service';
import {
    AlertCircle,
    ArrowRight,
    Check,
    CheckCircle2,
    Clock,
    FastForward,
    Loader2,
    Package,
    User,
    X
} from 'lucide-react';
import { useEffect, useState } from 'react';

interface SelectedRunItem {
    id: string;
    runNumber: number;
    statusCode: string;
    lifeCycleStatusCode?: string;
    orderProcess?: {
        id?: string;
        name?: string;
        order?: {
            id: string;
            code: string;
            customer?: {
                name: string;
            };
        };
    };
    orderProcessId?: string;
    runTemplate?: {
        name: string;
    };
    fields?: Record<string, any>;
}

interface RunTransitionTarget {
    run: SelectedRunItem;
    currentStage: string;
    nextStage: string | null;
    orderProcessId: string;
    orderId: string;
    error?: string;
}

interface BulkTransitionModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedRuns: SelectedRunItem[];
    onSuccess: () => void;
}

export default function BulkTransitionModal({
    isOpen,
    onClose,
    selectedRuns,
    onSuccess
}: BulkTransitionModalProps) {
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [targets, setTargets] = useState<RunTransitionTarget[]>([]);
    const [expectedDate, setExpectedDate] = useState<string>(
        new Date().toISOString().split('T')[0]
    );
    const [isAdvancing, setIsAdvancing] = useState(false);
    const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
    const [executionErrors, setExecutionErrors] = useState<string[]>([]);

    useEffect(() => {
        if (!isOpen || selectedRuns.length === 0) {
            setTargets([]);
            setExecutionErrors([]);
            setProgress(null);
            return;
        }

        let cancelled = false;

        async function fetchLifecycleTargets() {
            setLoadingDetails(true);
            setExecutionErrors([]);
            setProgress(null);

            try {
                const results: RunTransitionTarget[] = await Promise.all(
                    selectedRuns.map(async (run) => {
                        const currentStage = run.lifeCycleStatusCode || run.statusCode || 'UNKNOWN';
                        const orderProcessId = run.orderProcessId || run.orderProcess?.id || '';
                        const orderId = run.orderProcess?.order?.id || '';

                        try {
                            const detail = await getRunById(run.id);
                            const lifecycle: Array<{ code: string }> = detail.lifecycle ?? [];
                            const currIdx = lifecycle.findIndex((s) => s.code === currentStage);

                            let nextStage: string | null = null;
                            if (currIdx !== -1 && currIdx < lifecycle.length - 1) {
                                nextStage = lifecycle[currIdx + 1].code;
                            }

                            return {
                                run,
                                currentStage,
                                nextStage,
                                orderProcessId: orderProcessId || detail.orderProcessId || detail.orderProcess?.id,
                                orderId: orderId || detail.orderProcess?.order?.id
                            };
                        } catch {
                            return {
                                run,
                                currentStage,
                                nextStage: null,
                                orderProcessId,
                                orderId,
                                error: 'Failed to fetch run details'
                            };
                        }
                    })
                );

                if (!cancelled) {
                    setTargets(results);
                }
            } catch (err) {
                console.error('Error fetching run details for bulk transition:', err);
            } finally {
                if (!cancelled) setLoadingDetails(false);
            }
        }

        fetchLifecycleTargets();

        return () => {
            cancelled = true;
        };
    }, [isOpen, selectedRuns]);

    if (!isOpen) return null;

    const commonCurrentStage = targets.length > 0 ? targets[0].currentStage : '';
    const commonNextStage = targets.length > 0 ? targets[0].nextStage : null;
    const validTargets = targets.filter((t) => t.nextStage && !t.error);
    const invalidTargets = targets.filter((t) => !t.nextStage || t.error);

    const handleExecuteBulkTransition = async () => {
        if (validTargets.length === 0) return;

        setIsAdvancing(true);
        setExecutionErrors([]);
        setProgress({ current: 0, total: validTargets.length });

        const errors: string[] = [];
        let successCount = 0;

        for (let i = 0; i < validTargets.length; i++) {
            const item = validTargets[i];
            setProgress({ current: i + 1, total: validTargets.length });

            try {
                const res = await transitionLifeCycle(
                    item.orderId,
                    item.orderProcessId,
                    item.run.id,
                    {
                        statusCode: item.nextStage!,
                        expectedDate
                    }
                );

                if (res.success) {
                    successCount++;
                } else {
                    errors.push(`Run #${item.run.runNumber} (${item.run.orderProcess?.order?.code}): Transition refused`);
                }
            } catch (err: any) {
                const errMsg = err?.message || 'Transition failed';
                errors.push(`Run #${item.run.runNumber} (${item.run.orderProcess?.order?.code}): ${errMsg}`);
            }
        }

        setIsAdvancing(false);
        setProgress(null);

        if (errors.length > 0) {
            setExecutionErrors(errors);
        }

        if (successCount > 0) {
            if (errors.length === 0) {
                onSuccess();
                onClose();
            } else {
                // Partial success: notify parent to refresh runs data
                onSuccess();
            }
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                            <FastForward className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">Batch Advance Stage</h2>
                            <p className="text-xs text-gray-500">
                                Advance {selectedRuns.length} selected process run{selectedRuns.length > 1 ? 's' : ''} to next lifecycle stage
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isAdvancing}
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto space-y-5 flex-1">
                    {loadingDetails ? (
                        <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                            <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mb-3" />
                            <p className="text-sm font-medium">Checking lifecycle stages...</p>
                        </div>
                    ) : (
                        <>
                            {/* Stage Transition Banner */}
                            <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-emerald-50 rounded-xl p-4 border border-blue-100/80 flex items-center justify-around text-center shadow-xs">
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Current Stage</span>
                                    <div className="text-sm font-bold text-gray-800 mt-0.5 px-3 py-1 bg-white/80 rounded-lg border border-blue-100 shadow-xs">
                                        {commonCurrentStage.replace(/_/g, ' ')}
                                    </div>
                                </div>
                                <ArrowRight className="w-5 h-5 text-indigo-400 animate-pulse" />
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Target Stage</span>
                                    <div className="text-sm font-bold text-emerald-700 mt-0.5 px-3 py-1 bg-emerald-100/90 rounded-lg border border-emerald-200 shadow-xs">
                                        {commonNextStage ? commonNextStage.replace(/_/g, ' ') : 'None / Completed'}
                                    </div>
                                </div>
                            </div>

                            {/* Date Picker */}
                            <div className="flex items-center justify-between bg-gray-50 p-3.5 rounded-xl border border-gray-200">
                                <div>
                                    <label className="text-xs font-semibold text-gray-700 block">Expected Completion Date</label>
                                    <p className="text-[11px] text-gray-500">Set completion timestamp target for this stage transition</p>
                                </div>
                                <input
                                    type="date"
                                    value={expectedDate}
                                    onChange={(e) => setExpectedDate(e.target.value)}
                                    disabled={isAdvancing}
                                    className="px-3 py-1.5 text-xs font-semibold border border-gray-300 rounded-lg bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                                />
                            </div>

                            {/* Execution Error Alert */}
                            {executionErrors.length > 0 && (
                                <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 space-y-1 text-xs text-red-700">
                                    <div className="flex items-center gap-1.5 font-bold text-red-800">
                                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                        <span>Some runs could not be transitioned:</span>
                                    </div>
                                    <ul className="list-disc list-inside space-y-0.5 text-[11px] pl-1">
                                        {executionErrors.map((err, idx) => (
                                            <li key={idx}>{err}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Selected Runs List */}
                            <div>
                                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                                    Selected Runs ({targets.length})
                                </h4>
                                <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                                    {targets.map(({ run, nextStage, error }) => {
                                        const rawCode = run.orderProcess?.order?.code;
                                        const orderCode = typeof rawCode === 'object' ? (rawCode as any).code : rawCode;
                                        const customerName = run.orderProcess?.order?.customer?.name;
                                        const rawName = run.runTemplate?.name || 'Process Run';
                                        const displayName = run.orderProcess?.name || rawName.replace(/ Template$/i, '');

                                        return (
                                            <div key={run.id} className="p-3 bg-white hover:bg-gray-50 flex items-center justify-between gap-3 text-xs transition">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600 font-bold text-xs flex-shrink-0">
                                                        #{run.runNumber}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="font-semibold text-gray-900 truncate">
                                                            {displayName} <span className="text-gray-400 font-normal">({orderCode || 'Order'})</span>
                                                        </div>
                                                        {customerName && (
                                                            <div className="text-[11px] text-gray-500 truncate">
                                                                {customerName}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                    {nextStage ? (
                                                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold rounded-md flex items-center gap-1">
                                                            <Check className="w-3 h-3 text-emerald-600" />
                                                            Ready
                                                        </span>
                                                    ) : (
                                                        <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold rounded-md flex items-center gap-1">
                                                            <AlertCircle className="w-3 h-3 text-amber-600" />
                                                            {error || 'No Next Stage'}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer Controls */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                    <button
                        onClick={onClose}
                        disabled={isAdvancing}
                        className="px-4 py-2 border border-gray-300 text-gray-700 hover:bg-white text-xs font-bold rounded-xl transition shadow-xs disabled:opacity-50"
                    >
                        Cancel
                    </button>

                    <button
                        onClick={handleExecuteBulkTransition}
                        disabled={loadingDetails || isAdvancing || validTargets.length === 0}
                        className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white text-xs font-bold rounded-xl transition shadow-md flex items-center gap-2"
                    >
                        {isAdvancing ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>
                                    Advancing {progress ? `${progress.current}/${progress.total}` : ''}...
                                </span>
                            </>
                        ) : (
                            <>
                                <CheckCircle2 className="w-4 h-4" />
                                <span>Advance {validTargets.length} Run{validTargets.length > 1 ? 's' : ''}</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
