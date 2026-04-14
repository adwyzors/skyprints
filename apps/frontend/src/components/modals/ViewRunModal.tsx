'use client';

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from 'react';

import { useAuth } from '@/auth/AuthProvider';
import { Permission } from '@/auth/permissions';
import { configureRun, getRunById, transitionLifeCycle } from '@/services/run.service';
import { ArrowRight, CheckCircle, ChevronRight, Clock, FastForward, FileText, Image as ImageIcon, RotateCcw, Settings, User, X } from 'lucide-react';
import Link from 'next/link';
import RunConfigForm from '../runs/RunConfigForm';
import ConfigurationModal from './ConfigurationModal';
import ImagePreviewModal from './ImagePreviewModal';

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
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [editedComments, setEditedComments] = useState('');
    const [isEditingComments, setIsEditingComments] = useState(false);
    const [transitionPrompt, setTransitionPrompt] = useState<{
        targetStatusCode?: string;
        stepName?: string;
    } | null>(null);
    const [expectedDate, setExpectedDate] = useState<string>(
        new Date().toISOString().split('T')[0]
    );
    const [updatingComments, setUpdatingComments] = useState(false);
    const { user, hasPermission } = useAuth();
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
            setEditedComments(fetched.comments || '');

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
        if (hasPermission(Permission.RUNS_LIFECYCLE_UPDATE)) return true;

        const processName = run?.orderProcess?.name || '';

        // Embellishment process can be digital if its internal "Process Name" value reflects a digital process
        const internalProcessName = run?.fields?.['Process Name'] || run?.values?.['Process Name'] || '';
        const isDigitalProcess = DIGITAL_PROCESSES.includes(processName) ||
            (processName === 'Embellishment' && DIGITAL_PROCESSES.includes(internalProcessName));

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
            if (isDigitalProcess && (currentCode === 'FUSING' || currentCode === 'CURING')) {
                return true;
            }
        }

        return false;
    };

    /* =================================================
       ACTIONS
       ================================================= */
    const handleTransition = async (targetStatusCode?: string, overrideExpectedDate?: string) => {
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
                { 
                    statusCode: nextStatusCode,
                    expectedDate: overrideExpectedDate
                }
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

    const handleTransitionRequest = (targetStatusCode?: string, stepName?: string) => {
        setExpectedDate(new Date().toISOString().split('T')[0]);
        setTransitionPrompt({ targetStatusCode, stepName });
    };
    
    const handleUpdateComments = async () => {
        if (!run) return;
        setUpdatingComments(true);
        try {
            const response = await configureRun(
                run.orderProcess.order.id,
                run.orderProcessId,
                run.id,
                run.fields || {},
                run.values?.images || [],
                run.executor?.id,
                run.reviewer?.id,
                run.locationId || undefined,
                editedComments
            );

            if (response.success) {
                setRun((prev: any) => ({ ...prev, comments: editedComments }));
                setIsEditingComments(false);
                if (onRunUpdate) onRunUpdate();
            }
        } catch (err) {
            console.error('Failed to update comments:', err);
            alert('Failed to update comments');
        } finally {
            setUpdatingComments(false);
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
                                    <div className="border-t border-gray-100 my-2 pt-2"></div>
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-gray-500 flex items-center gap-2">
                                                <FileText className="w-3 h-3" /> Comments
                                            </span>
                                            {hasPermission(Permission.RUNS_UPDATE) && (
                                                <button 
                                                    onClick={() => {
                                                        if (!isEditingComments) {
                                                            setEditedComments(run.comments || '');
                                                        }
                                                        setIsEditingComments(!isEditingComments);
                                                    }}
                                                    className="text-xs text-blue-600 hover:text-blue-700 font-medium whitespace-nowrap"
                                                >
                                                    {isEditingComments ? 'Cancel' : (run.comments ? 'Edit' : '+ Add')}
                                                </button>
                                            )}
                                        </div>
                                        {isEditingComments ? (
                                            <div className="mt-1 space-y-2">
                                                <textarea
                                                    value={editedComments}
                                                    onChange={(e) => setEditedComments(e.target.value)}
                                                    className="w-full text-sm p-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none min-h-[80px] bg-white shadow-inner"
                                                    placeholder="Add run notes or comments..."
                                                />
                                                <button
                                                    onClick={handleUpdateComments}
                                                    disabled={updatingComments}
                                                    className="w-full py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                                                >
                                                    {updatingComments ? 'Saving...' : 'Save Comments'}
                                                </button>
                                            </div>
                                        ) : (
                                            run.comments ? (
                                                <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded border border-gray-100 italic">
                                                    "{run.comments}"
                                                </p>
                                            ) : (
                                                <p className="text-sm text-gray-400 italic px-2">No comments added</p>
                                            )
                                        )}
                                    </div>

                                </div>
                            </div>

                            {/* Run Images */}
                            {run.fields?.images && run.fields.images.length > 0 && (
                                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                        <ImageIcon className="w-3 h-3" /> Run Images
                                    </h3>
                                    <div className="flex gap-2">
                                        {run.fields.images.map((url: string, i: number) => (
                                            <div
                                                key={i}
                                                className="w-20 h-20 border border-gray-200 rounded-lg overflow-hidden cursor-pointer hover:border-blue-500 transition-colors"
                                                onClick={() => setSelectedImage(url)}
                                            >
                                                <img
                                                    src={url}
                                                    alt={`Run Image ${i + 1}`}
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {/* Activity History */}
                            {run.lifecycleHistory && run.lifecycleHistory.length > 0 && (
                                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                        <Clock className="w-3 h-3" /> Activity History
                                    </h3>
                                    <div className="space-y-4">
                                        {run.lifecycleHistory.map((h: any, i: number) => (
                                            <div key={i} className="relative pl-4 border-l-2 border-blue-100 py-1">
                                                <div className="absolute -left-[5px] top-2 w-2 h-2 rounded-full bg-blue-400" />
                                                <div className="text-xs font-semibold text-gray-800">
                                                    {getStatusDisplayName(h.statusCode)}
                                                </div>
                                                <div className="text-[10px] text-gray-500 mt-1">
                                                    {new Date(h.createdAt).toLocaleString(undefined, { 
                                                        day: '2-digit', month: 'short', 
                                                        hour: '2-digit', minute: '2-digit' 
                                                    })}
                                                </div>
                                                {h.completedAt && (
                                                    <div className="text-[10px] text-green-600 mt-0.5">
                                                        Completed: {new Date(h.completedAt).toLocaleDateString()}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
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
                                initialComments={run.comments}
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
                                                                                    onClick={() => handleTransitionRequest(step.code, getStatusDisplayName(step.code))}
                                                                                    disabled={updating}
                                                                                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                                                    title="Skip to this step"
                                                                                >
                                                                                    <FastForward className="w-4 h-4" />
                                                                                </button>
                                                                            )}
                                                                            {isCompleted && hasPermission(Permission.RUNS_LIFECYCLE_ROLLBACK) && (
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

                                                        <p className="text-sm text-gray-500 mb-1">
                                                            {isCompleted ? 'Completed' : isCurrent ? 'Current Stage' : 'Pending'}
                                                        </p>

                                                        {/* Date display */}
                                                        {(step.completedAt || step.expectedDate) && (
                                                            <div className="flex flex-col gap-1 mt-2 p-2 bg-white/50 rounded-md border border-gray-100/50 text-xs">
                                                                {step.expectedDate && (
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-gray-400 flex items-center gap-1">
                                                                            <Settings className="w-2.5 h-2.5" />
                                                                        Expected:
                                                                        </span>
                                                                        <span className={`${!step.completedAt && new Date(step.expectedDate) < new Date() ? 'text-red-500 font-medium' : 'text-blue-600'}`}>
                                                                            {new Date(step.expectedDate).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                                {step.completedAt && (
                                                                    <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                                                                        <span className="text-gray-400 flex items-center gap-1">
                                                                            <CheckCircle className="w-2.5 h-2.5 text-green-500" />
                                                                        Completed:
                                                                        </span>
                                                                        <span className="text-green-600 font-medium">
                                                                            {new Date(step.completedAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                        <div className="mb-4"></div>

                                                        {/* CURRENT ACTION */}
                                                        {isCurrent && getCanTransition(currentStepCode) && (
                                                            <button
                                                                onClick={() => {
                                                                    const nextStep = lifecycleSteps[index + 1];
                                                                    handleTransitionRequest(nextStep?.code, nextStep ? getStatusDisplayName(nextStep.code) : undefined);
                                                                }}
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
            <ImagePreviewModal
                imageUrl={selectedImage}
                onClose={() => setSelectedImage(null)}
                title="Run Image"
            />

            {/* TRANSITION EXPECTED DATE MODAL */}
            {transitionPrompt && (
                <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-5">
                            <h3 className="text-lg font-bold text-gray-800 mb-2">
                                {transitionPrompt.stepName ? (
                                    <>
                                        Move to <span className="text-green-600 font-semibold">{transitionPrompt.stepName}</span>
                                    </>
                                ) : 'Move to Next Step'}
                            </h3>
                            <p className="text-sm text-gray-500 mb-4">
                                Please confirm or update the expected completion date for <span className="font-medium text-gray-700">{transitionPrompt.stepName || 'this step'}</span>.
                            </p>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Expected Date
                            </label>
                            <input
                                type="date"
                                value={expectedDate}
                                onChange={(e) => setExpectedDate(e.target.value)}
                                min={new Date().toISOString().split('T')[0]}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                        <div className="px-5 py-3 bg-gray-50 flex justify-end gap-2 border-t border-gray-100">
                            <button
                                onClick={() => setTransitionPrompt(null)}
                                disabled={updating}
                                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleTransition(transitionPrompt.targetStatusCode, expectedDate)}
                                disabled={updating}
                                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
                            >
                                {updating ? 'Updating...' : 'Confirm'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}
