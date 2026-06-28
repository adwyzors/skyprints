'use client';

import { useEffect, useRef, useState } from 'react';
import { getRunById, transitionLifeCycle } from '@/services/run.service';
import { CheckCircle, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import ConfigurationModal from './ConfigurationModal';

interface ManagerRunModalProps {
    runId: string;
    onClose: () => void;
    onTransitionComplete?: () => void;
}

export default function ManagerRunModal({ runId, onClose, onTransitionComplete }: ManagerRunModalProps) {
    const [run, setRun] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [transitioning, setTransitioning] = useState(false);
    const [mobilePanelTab, setMobilePanelTab] = useState<'progress' | 'config'>('progress');
    const hasFetchedRef = useRef(false);

    useEffect(() => {
        setMobilePanelTab('progress');
    }, [runId]);

    useEffect(() => {
        if (hasFetchedRef.current) return;
        hasFetchedRef.current = true;
        getRunById(runId)
            .then(setRun)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [runId]);

    const getStatusDisplayName = (code: string) =>
        code.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

    const handleMarkComplete = async () => {
        if (!run) return;
        setTransitioning(true);
        try {
            const lifecycle: Array<{ code: string }> = run.lifecycle ?? [];
            const prodIdx = lifecycle.findIndex((s) => s.code === 'PRODUCTION');
            const nextStage =
                prodIdx >= 0 && prodIdx < lifecycle.length - 1
                    ? lifecycle[prodIdx + 1].code
                    : null;
            if (!nextStage) throw new Error('No next stage after PRODUCTION');
            await transitionLifeCycle(
                run.orderProcess.order.id,
                run.orderProcessId,
                run.id,
                { statusCode: nextStage },
            );
            onTransitionComplete?.();
            onClose();
        } catch (err) {
            console.error('Transition failed:', err);
            toast.error(err instanceof Error ? err.message : 'Failed to advance run stage');
        } finally {
            setTransitioning(false);
        }
    };

    if (loading) {
        return (
            <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
                <div className="bg-white w-full max-w-5xl h-[90vh] rounded-2xl flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                </div>
            </div>
        );
    }

    if (!run) return null;

    const lifecycleSteps = (run.lifecycle || []).filter(
        (step: any) => step.code !== 'COMPLETE' && step.code !== 'BILLED',
    );
    const currentStepCode = run.lifecycleStatus || run.lifeCycleStatusCode;

    return (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center sm:p-4 backdrop-blur-sm">
            <div className="bg-white w-full h-full sm:max-w-5xl sm:h-[90vh] sm:rounded-2xl flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                {/* MOBILE TAB BAR */}
                <div className="sm:hidden flex items-center border-b border-gray-200 bg-white flex-shrink-0">
                    <button
                        onClick={() => setMobilePanelTab('progress')}
                        className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-colors ${mobilePanelTab === 'progress' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}
                    >
                        Progress
                    </button>
                    <button
                        onClick={() => setMobilePanelTab('config')}
                        className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-colors ${mobilePanelTab === 'config' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}
                    >
                        Config
                    </button>
                    <button onClick={onClose} className="px-4 py-3 text-gray-500 hover:text-gray-700 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* PANELS */}
                <div className="flex-1 flex overflow-hidden">
                {/* LEFT PANEL — lifecycle only */}
                <div className={`${mobilePanelTab === 'progress' ? 'flex' : 'hidden sm:flex'} w-full sm:w-72 flex-shrink-0 border-r border-gray-200 bg-gray-50/50 flex-col h-full`}>
                    <div className="flex items-start justify-between px-5 pt-5 pb-4 flex-shrink-0">
                        <div>
                            <h2 className="text-lg font-bold text-gray-800">Run #{run.runNumber}</h2>
                            {run.orderProcess?.name && (
                                <span className="text-xs text-gray-500">{run.orderProcess.name}</span>
                            )}
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1 hover:bg-gray-200 rounded-full transition-colors mt-0.5"
                        >
                            <X className="w-4 h-4 text-gray-500" />
                        </button>
                    </div>

                    <p className="px-5 pb-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex-shrink-0">
                        Lifecycle Progress
                    </p>

                    <div className="flex-1 overflow-y-auto min-h-0 px-5 pb-5">
                        <div className="relative pl-7 space-y-5">
                            <div className="absolute left-3 top-3 bottom-6 w-0.5 bg-gray-200" />

                            {lifecycleSteps.map((step: any) => {
                                const isCompleted = step.completed;
                                const isCurrent = step.code === currentStepCode;

                                return (
                                    <div key={step.code} className="relative">
                                        <div
                                            className={`absolute -left-[25px] top-1 z-10 w-5 h-5 rounded-full border-4 flex items-center justify-center transition-colors ${
                                                isCompleted
                                                    ? 'bg-green-500 border-green-100'
                                                    : isCurrent
                                                    ? 'bg-blue-600 border-blue-100'
                                                    : 'bg-white border-gray-200'
                                            }`}
                                        >
                                            {isCompleted && <CheckCircle className="w-2.5 h-2.5 text-white" />}
                                            {isCurrent && (
                                                <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                                            )}
                                        </div>

                                        <div
                                            className={`rounded-lg border p-3 transition-all ${
                                                isCurrent
                                                    ? 'border-blue-200 bg-blue-50/50 ring-1 ring-blue-100'
                                                    : isCompleted
                                                    ? 'border-green-100 bg-green-50/30'
                                                    : 'border-gray-100 bg-white'
                                            }`}
                                        >
                                            <h4
                                                className={`font-semibold text-sm ${
                                                    isCurrent
                                                        ? 'text-blue-700'
                                                        : isCompleted
                                                        ? 'text-green-700'
                                                        : 'text-gray-500'
                                                }`}
                                            >
                                                {getStatusDisplayName(step.code)}
                                            </h4>
                                            <p className="text-xs text-gray-400 mt-0.5">
                                                {isCompleted ? 'Completed' : isCurrent ? 'Current Stage' : 'Pending'}
                                            </p>

                                            {step.code === 'PRODUCTION' && isCurrent && (
                                                <button
                                                    onClick={handleMarkComplete}
                                                    disabled={transitioning}
                                                    className="mt-2 w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white text-xs font-semibold transition-colors"
                                                >
                                                    {transitioning ? (
                                                        <Loader2 className="w-3 h-3 animate-spin" />
                                                    ) : (
                                                        <CheckCircle className="w-3 h-3" />
                                                    )}
                                                    {transitioning ? 'Advancing…' : 'Mark Complete'}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* RIGHT PANEL — configuration content */}
                <div className={`${mobilePanelTab === 'config' ? 'flex' : 'hidden sm:flex'} flex-1 overflow-hidden flex-col min-w-0`}>
                    <ConfigurationModal
                        inline
                        run={{
                            ...run,
                            fields: run.templateFields,
                            values: run.fields,
                        }}
                        processName={run.displayName}
                        orderCode={run.orderProcess.order.code}
                        customerName={run.orderProcess.order.customer.name}
                        onClose={onClose}
                        readOnly
                    />
                </div>
                </div>{/* /PANELS */}
            </div>
        </div>
    );
}
