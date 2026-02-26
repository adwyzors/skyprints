'use client';

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from 'react';

import { useAuth } from '@/auth/AuthProvider';
import { Permission } from '@/auth/permissions';
import { getRunById, transitionLifeCycle } from '@/services/run.service';
import { ArrowRight, CheckCircle, ChevronRight, FastForward, RotateCcw, Settings, User, X } from 'lucide-react';
import Link from 'next/link';
import RunConfigForm from '../runs/RunConfigForm';
import ConfigurationModal from './ConfigurationModal';

interface ViewRunModalProps {
    runId: string;
    onClose: () => void;
    onRunUpdate?: () => void;
}

export default function ViewRunModal({ runId, onClose, onRunUpdate }: ViewRunModalProps) {
    const [run, setRun] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [configModalOpen, setConfigModalOpen] = useState(false);
    const { user, hasPermission } = useAuth();

    const router = useRouter(); // Moved to top
    const hasFetchedRef = useRef(false);

    // Removed auto-redirect useEffect

    /* =================================================
       FETCH RUN
       ================================================= */
    const fetchRun = async () => {
        setLoading(true);
        try {
            const fetched = await getRunById(runId);
            setRun(fetched);
        } catch (error) {
            console.error('Error fetching run:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (hasFetchedRef.current) return;
        hasFetchedRef.current = true;
        fetchRun();
    }, [runId]);

    /* =================================================
       HELPERS
       ================================================= */
    const getStatusDisplayName = (status: string): string => {
        return status
            .replace(/_/g, ' ')
            .toLowerCase()
            .replace(/\b\w/g, (c) => c.toUpperCase());
    };

    /* =================================================
       RBAC HELPERS
       ================================================= */
    const DIGITAL_PROCESSES = ['Sublimation', 'Plotter', 'DTF', 'Laser', 'Allover Sublimation'];

    const getCanTransition = (currentCode: string, targetCode?: string) => {
        // Full permission can do everything
        if (hasPermission(Permission.RUNS_UPDATE)) return true;

        const processName = run?.orderProcess?.name || '';
        const isDigitalProcess = DIGITAL_PROCESSES.includes(processName);

        // Find next step if targetCode not provided
        let nextCode = targetCode;
        if (!nextCode) {
            const steps = run?.lifecycle || [];
            const idx = steps.findIndex((s: any) => s.code === currentCode);
            if (idx !== -1 && idx < steps.length - 1) {
                nextCode = steps[idx + 1].code;
            }
        }

        // DIGITAL Role Constraints
        if (hasPermission(Permission.RUNS_TRANSITION_DIGITAL)) {
            if (isDigitalProcess && currentCode === 'PRODUCTION' && nextCode === 'FUSING') {
                return true;
            }
        }

        // FUSING Role Constraints
        if (hasPermission(Permission.RUNS_TRANSITION_FUSING)) {
            if (currentCode === 'FUSING' || currentCode === 'CURING') {
                return true;
            }
        }

        return false;
    };

    /* =================================================
       ACTIONS
       ================================================= */
    const handleTransition = async (targetStatusCode?: string) => {
        if (!run) return;

        const currentStatus = run.lifecycleStatus || run.lifeCycleStatusCode;
        if (!getCanTransition(currentStatus, targetStatusCode)) {
            alert('You do not have permission to perform this transition');
            return;
        }

        setUpdating(true);
        try {
            const currentStatus = run.lifecycleStatus || run.lifeCycleStatusCode;
            const lifecycleSteps = run.lifecycle || [];
            const currentIndex = lifecycleSteps.findIndex((step: any) => step.code === currentStatus);

            // If explicit target provided, use it. Else find next.
            let nextStatusCode = targetStatusCode;

            if (!nextStatusCode) {
                if (currentIndex === -1 || currentIndex >= lifecycleSteps.length - 1) {
                    throw new Error('No next step available');
                }
                nextStatusCode = lifecycleSteps[currentIndex + 1].code;
            }

            const response = await transitionLifeCycle(
                run.orderProcess.order.id,
                run.orderProcessId,
                run.id,
                { statusCode: nextStatusCode }
            );

            if (response.success) {
                // Optimistic Update: Update local state without refetching
                setRun((prev: any) => {
                    if (!prev) return prev;

                    const newStatusIndex = (prev.lifecycle || []).findIndex((s: any) => s.code === nextStatusCode);

                    const updatedLifecycle = (prev.lifecycle || []).map((step: any, index: number) => {
                        return {
                            ...step,
                            completed: index < newStatusIndex
                        };
                    });

                    return {
                        ...prev,
                        lifecycleStatus: nextStatusCode,
                        lifeCycleStatusCode: nextStatusCode,
                        lifecycle: updatedLifecycle
                    };
                });

                if (onRunUpdate) onRunUpdate();
            }
        } catch (err) {
            console.error('Failed to transition:', err);
            alert('Failed to update status');
        } finally {
            setUpdating(false);
        }
    };

    /* =================================================
       RENDER
       ================================================= */
    if (loading && !run) {
        return (
            <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
                <div className="bg-white w-full max-w-5xl h-[80vh] rounded-2xl flex items-center justify-center">
                    <div className="text-gray-600">Loading run details...</div>
                </div>
            </div>
        );
    }

    if (!run) return null;

    const lifecycleSteps = (run.lifecycle || []).filter(
        (step: any) => step.code !== 'COMPLETE' && step.code !== 'BILLED'
    );
    const isRunComplete = run.lifecycleStatus === 'BILLED' || run.lifeCycleStatusCode === 'BILLED'; // Verify status code for complete

    // Determine current status for display
    // Determine current status for display
    const currentStepCode = run.lifecycleStatus || run.lifeCycleStatusCode;
    const statusCode = run.statusCode;

    // Hook logic moved to top

    // Safe formatting for currency/numbers

    // Safe formatting for currency/numbers
    const formatCurrency = (val: any) => {
        if (val == null) return '-';
        return `₹${Number(val).toLocaleString()}`;
    };

    // Removed early return for CONFIGURE logic, now handled in render


    return (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white w-full max-w-5xl h-[80vh] rounded-2xl flex overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">

                {/* LEFT SIDE - DETAILS */}
                <div className="w-1/3 border-r border-gray-200 bg-gray-50/50 p-6 flex flex-col h-full">
                    <div className="flex-1 overflow-y-auto min-h-0">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-2">
                                <h2 className="text-xl font-bold text-gray-800">Run #{run.runNumber}</h2>
                                {run.orderProcess?.name && (
                                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                                        {run.orderProcess.name}
                                    </span>
                                )}
                            </div>
                            <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        <div className="space-y-6">
                            {/* Order Info */}
                            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Order Details</h3>
                                <div className="space-y-3">


                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-gray-500">Order Code</span>
                                        <Link
                                            href={`/admin/orders/${run.orderProcess.order.id}`}
                                            target="_blank"
                                            className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1 group"
                                        >
                                            {run.orderProcess.order.code}
                                            <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                                        </Link>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm text-gray-500">Customer</span>
                                        <span className="text-sm font-medium text-gray-900">{run.orderProcess.order.customer.name}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Run Stats */}
                            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Run Metadata</h3>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-gray-500 flex items-center gap-2">
                                            <User className="w-3 h-3" /> Executor
                                        </span>
                                        <span className="text-sm font-medium text-gray-900">{run.executor?.name || '-'}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-gray-500 flex items-center gap-2">
                                            <User className="w-3 h-3" /> Reviewer
                                        </span>
                                        <span className="text-sm font-medium text-gray-900">{run.reviewer?.name || '-'}</span>
                                    </div>
                                    <div className="border-t border-gray-100 my-2 pt-2"></div>
                                    <div className="flex justify-between">
                                        <span className="text-sm text-gray-500">Quantity</span>
                                        <span className="text-sm font-bold text-gray-900">{run.fields?.Quantity || '-'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm text-gray-500">Est. Amount</span>
                                        <span className="text-sm font-bold text-green-600">{formatCurrency(run.fields?.['Estimated Amount'])}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 mt-auto">
                        <button
                            onClick={() => setConfigModalOpen(true)}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-300 shadow-sm hover:shadow text-gray-700 font-medium rounded-xl transition-all hover:bg-gray-50"
                        >
                            <Settings className="w-4 h-4" />
                            View Configuration
                        </button>
                    </div>
                </div>

                {/* RIGHT SIDE - TIMELINE OR CONFIGURE ACTION */}
                <div className="flex-1 p-8 overflow-y-auto bg-white">
                    {statusCode === 'CONFIGURE' && run.configStatus !== 'COMPLETE' ? (
                        <div className="max-w-3xl mx-auto">
                            <RunConfigForm
                                runId={run.id}
                                runNumber={run.runNumber}
                                displayName={run.orderProcess?.name || run.displayName || run.runTemplate?.name || 'Run'}
                                processId={run.orderProcessId}
                                orderId={run.orderProcess.order.id}
                                orderQuantity={run.orderProcess.order.quantity}
                                initialValues={run.fields || {}}
                                fieldDefinitions={run.templateFields || []}
                                initialExecutor={run.executor}
                                initialReviewer={run.reviewer}
                                orderImages={run.orderProcess.order.images || []}
                                useOrderImageForRuns={run.orderProcess.order.useOrderImageForRuns || false}
                                onSaveSuccess={() => {
                                    fetchRun();
                                    if (onRunUpdate) onRunUpdate();
                                }}
                                onCancel={onClose}
                            />
                        </div>
                    ) : (
                        <div className="max-w-xl mx-auto">
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <h1 className="text-2xl font-bold text-gray-900 mb-1">
                                        {run.orderProcess?.name || run.displayName.replace(/ Template$/i, '')}
                                    </h1>
                                    {run.orderProcess.order.statusCode === 'IN_PRODUCTION' && (
                                        <p className="text-sm text-gray-500">Lifecycle Progress</p>
                                    )}
                                </div>
                                <span className={`px-3 py-1 rounded-full text-sm font-medium ${run.configStatus === 'COMPLETE' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                                    }`}>
                                    {run.configStatus === 'COMPLETE' ? 'Active' : run.configStatus}
                                </span>
                            </div>

                            {/* TIMELINE */}
                            {run.orderProcess.order.statusCode === 'IN_PRODUCTION' && (
                                <div className="relative pl-8 space-y-8">
                                    {/* Vertical Line */}
                                    <div className="absolute left-3 top-3 bottom-6 w-0.5 bg-gray-200" />

                                    {lifecycleSteps.map((step: any, index: number) => {
                                        const isCompleted = step.completed;
                                        const isCurrent = step.code === currentStepCode;

                                        return (
                                            <div key={step.code} className="relative group">
                                                {/* DOT */}
                                                <div className={`absolute -left-[29px] top-1 z-10 w-6 h-6 rounded-full border-4 flex items-center justify-center transition-colors ${isCompleted ? 'bg-green-500 border-green-100' :
                                                    isCurrent ? 'bg-blue-600 border-blue-100' :
                                                        'bg-white border-gray-200'
                                                    }`}>
                                                    {isCompleted && <CheckCircle className="w-3 h-3 text-white" />}
                                                    {isCurrent && <div className="w-2 h-2 bg-white rounded-full animate-pulse" />}
                                                </div>

                                                {/* CONTENT CARD */}
                                                <div className={`rounded-xl border transition-all duration-200 ${isCurrent ? 'border-blue-200 bg-blue-50/50 shadow-md ring-1 ring-blue-100' :
                                                    isCompleted ? 'border-green-100 bg-green-50/30' :
                                                        'border-gray-100 bg-white hover:border-gray-200'
                                                    }`}>
                                                    <div className="p-5">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <h4 className={`font-semibold text-lg ${isCurrent ? 'text-blue-700' :
                                                                isCompleted ? 'text-green-700' :
                                                                    'text-gray-600'
                                                                }`}>
                                                                {getStatusDisplayName(step.code)}
                                                            </h4>

                                                            {/* Skip/Rollback Action */}
                                                            {!isCurrent && (
                                                                <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1">
                                                                    {!isCompleted && getCanTransition(currentStepCode, step.code) && (
                                                                        <button
                                                                            onClick={() => handleTransition(step.code)}
                                                                            disabled={updating}
                                                                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                                            title="Skip to this step"
                                                                        >
                                                                            <FastForward className="w-4 h-4" />
                                                                        </button>
                                                                    )}
                                                                    {isCompleted && hasPermission(Permission.RUNS_LIFECYCLE_UPDATE) && (
                                                                        <button
                                                                            onClick={() => {
                                                                                if (confirm(`Are you sure you want to rollback to ${getStatusDisplayName(step.code)}?`)) {
                                                                                    handleTransition(step.code);
                                                                                }
                                                                            }}
                                                                            disabled={updating}
                                                                            className="p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-all"
                                                                            title="Rollback to this step"
                                                                        >
                                                                            <RotateCcw className="w-4 h-4" />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>

                                                        <p className="text-sm text-gray-500 mb-4">
                                                            {isCompleted ? 'Completed' : isCurrent ? 'Current Stage' : 'Pending'}
                                                        </p>

                                                        {/* CURRENT ACTION */}
                                                        {isCurrent && getCanTransition(currentStepCode) && (
                                                            <button
                                                                onClick={() => handleTransition()}
                                                                disabled={updating}
                                                                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-all shadow-sm hover:shadow disabled:opacity-70 disabled:cursor-not-allowed"
                                                            >
                                                                {updating ? 'Processing...' : 'Mark Complete & Continue'}
                                                                {!updating && <ChevronRight className="w-4 h-4" />}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* NESTED CONFIG MODAL */}
            {
                configModalOpen && (
                    <ConfigurationModal
                        run={{
                            ...run,
                            fields: run.templateFields,
                            values: run.fields
                        }}
                        processName={run.displayName} // or runTemplate name
                        orderCode={run.orderProcess.order.code}
                        customerName={run.orderProcess.order.customer.name}
                        onClose={() => setConfigModalOpen(false)}
                        readOnly={true} // Assuming we just want to view? Or edit?
                    />
                )
            }
        </div >
    );
}
