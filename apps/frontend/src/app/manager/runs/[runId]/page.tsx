'use client';

import { Permission } from '@/auth/permissions';
import { withAuth } from '@/auth/withAuth';
import { getRunById, transitionLifeCycle } from '@/services/run.service';
import { ArrowLeft, CheckCircle, Clock, Loader2, Package } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface LifecycleStep {
    code: string;
    completed: boolean;
    expectedDate?: string | null;
    completedAt?: string | null;
}

function ManagerRunDetailPage({ params }: { params: { runId: string } }) {
    const router = useRouter();
    const [run, setRun] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [transitioning, setTransitioning] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        getRunById(params.runId)
            .then(setRun)
            .catch(() => setError('Failed to load run details.'))
            .finally(() => setLoading(false));
    }, [params.runId]);

    const lifecycle: LifecycleStep[] = run?.lifecycle ?? [];
    const prodIdx = lifecycle.findIndex(s => s.code === 'PRODUCTION');
    const nextStage = prodIdx >= 0 && prodIdx < lifecycle.length - 1
        ? lifecycle[prodIdx + 1].code
        : null;

    const handleMarkComplete = async () => {
        if (!nextStage || !run) return;
        setError(null);
        setTransitioning(true);
        try {
            await transitionLifeCycle('', run.orderProcessId, run.id, { statusCode: nextStage });
            router.push('/manager/runs');
        } catch {
            setError('Failed to advance stage. Please try again.');
        } finally {
            setTransitioning(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
        );
    }

    if (!run) {
        return (
            <div className="py-6 text-center text-gray-500">
                {error ?? 'Run not found.'}
            </div>
        );
    }

    const images: string[] = run.fields?.images ?? [];
    const orderCode = run.orderProcess?.order?.code ?? '';
    const customerName = run.orderProcess?.order?.customer?.name ?? '';
    const processName = run.orderProcess?.name ?? '';
    const quantity = run.fields?.Quantity ?? run.orderProcess?.order?.quantity;

    return (
        <div className="py-6 max-w-2xl mx-auto">
            {/* Header */}
            <button
                onClick={() => router.push('/manager/runs')}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors"
            >
                <ArrowLeft className="w-4 h-4" />
                Back to My Runs
            </button>

            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                {/* Image */}
                {images.length > 0 && (
                    <img
                        src={images[0]}
                        alt={orderCode}
                        className="w-full h-52 object-cover"
                    />
                )}

                <div className="p-6 space-y-6">
                    {/* Order info */}
                    <div>
                        <h1 className="text-lg font-bold text-gray-900">{processName}</h1>
                        <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                            <span className="font-medium text-gray-700">{orderCode.split('/')[0]}</span>
                            <span>•</span>
                            <span>{customerName}</span>
                            {quantity && (
                                <>
                                    <span>•</span>
                                    <span className="flex items-center gap-1">
                                        <Package className="w-3.5 h-3.5" />
                                        {quantity} pcs
                                    </span>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Lifecycle stepper */}
                    <div>
                        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                            Lifecycle Progress
                        </h2>
                        <div className="space-y-2">
                            {lifecycle.map((step, i) => {
                                const isCurrent = step.code === 'PRODUCTION';
                                const isPast = step.completed && step.code !== 'PRODUCTION';
                                return (
                                    <div
                                        key={step.code}
                                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${
                                            isCurrent
                                                ? 'bg-green-50 border border-green-200 text-green-800 font-semibold'
                                                : isPast
                                                ? 'text-gray-400'
                                                : 'text-gray-400'
                                        }`}
                                    >
                                        {isPast ? (
                                            <CheckCircle className="w-4 h-4 text-gray-300 flex-shrink-0" />
                                        ) : isCurrent ? (
                                            <div className="w-4 h-4 rounded-full bg-green-500 flex-shrink-0" />
                                        ) : (
                                            <Clock className="w-4 h-4 text-gray-200 flex-shrink-0" />
                                        )}
                                        <span>{step.code}</span>
                                        {isCurrent && (
                                            <span className="ml-auto text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                                                Current
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                            {error}
                        </p>
                    )}

                    {/* Action */}
                    {nextStage ? (
                        <button
                            onClick={handleMarkComplete}
                            disabled={transitioning}
                            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-semibold transition-colors"
                        >
                            {transitioning ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <CheckCircle className="w-4 h-4" />
                            )}
                            {transitioning ? 'Advancing…' : `Mark PRODUCTION Complete → ${nextStage}`}
                        </button>
                    ) : (
                        <p className="text-sm text-center text-gray-400">
                            This run has no further stages.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}

export default withAuth(ManagerRunDetailPage, { permission: Permission.RUNS_LIFECYCLE_UPDATE });
