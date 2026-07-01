'use client';

import { useEffect, useState } from 'react';
import { Clock, Loader2 } from 'lucide-react';
import { getRunById } from '@/services/run.service';

interface RunLifecycleHistoryProps {
    runId: string;
}

function getStatusDisplayName(status: string): string {
    return status
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Lazily fetches the same enriched lifecycle history ViewRunModal shows
// (statusCode, timestamps, and — when completed via the manager queue —
// which manager worked it and how long it took), rendered whenever a run
// row is expanded on the billing screen.
export default function RunLifecycleHistory({ runId }: RunLifecycleHistoryProps) {
    const [history, setHistory] = useState<any[] | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        getRunById(runId)
            .then((run: any) => {
                if (!cancelled) setHistory(run.lifecycleHistory ?? []);
            })
            .catch((err) => {
                console.error('Failed to load run lifecycle history:', err);
                if (!cancelled) setHistory([]);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [runId]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-4">
                <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            </div>
        );
    }

    if (!history || history.length === 0) return null;

    return (
        <div className="mb-4 bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="text-[10px] uppercase font-bold text-gray-500 mb-3 flex items-center gap-2">
                <Clock className="w-3 h-3" /> Lifecycle Timeline
            </div>
            <div className="space-y-2">
                {history.map((h: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-xs border-b border-gray-100 last:border-0 pb-2 last:pb-0">
                        <div>
                            <span className="font-semibold text-gray-700">{getStatusDisplayName(h.statusCode)}</span>
                            {h.manager && (
                                <span className="ml-2 text-blue-600">by {h.manager.name}</span>
                            )}
                        </div>
                        <div className="text-right text-gray-400">
                            <div>{new Date(h.createdAt).toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                            {h.completedAt && (
                                <div className="text-green-600">
                                    Ended {new Date(h.completedAt).toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
