'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ChevronDown, Clock, Loader2, UserPen } from 'lucide-react';
import { getRunById, updateStageHistoryManager } from '@/services/run.service';
import { listUsers, UserListItem } from '@/services/usersService';
import { toast } from 'sonner';

interface RunLifecycleHistoryProps {
    runId: string;
}

interface HistoryEntry {
    statusCode: string;
    expectedDate: string | null;
    completedAt: string | null;
    createdAt: string;
    manager?: { id: string; name: string } | null;
    /** Present only when a ProcessRunStageHistory record exists for this stage */
    stageHistoryId?: string | null;
}

function getStatusDisplayName(status: string): string {
    return status
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleString(undefined, {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Inline manager dropdown — rendered with position:fixed so it escapes
// overflow:hidden / overflow:auto ancestors (e.g. the scrollable modal panel)
// ─────────────────────────────────────────────────────────────────────────────
interface ManagerDropdownProps {
    runId: string;
    stageHistoryId: string;
    currentManagerId: string | null;
    managers: UserListItem[];
    onUpdated: (newManager: { id: string; name: string }) => void;
}

function ManagerDropdown({
    runId,
    stageHistoryId,
    currentManagerId,
    managers,
    onUpdated,
}: ManagerDropdownProps) {
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
    const buttonRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Calculate fixed position from the button's bounding rect when opening
    const handleToggle = () => {
        if (!open && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setDropdownPos({ top: rect.bottom + 4, left: rect.left });
        }
        setOpen((p) => !p);
    };

    // Close on outside click
    useEffect(() => {
        function onClickOutside(e: MouseEvent) {
            const target = e.target as Node;
            const outsideButton = !buttonRef.current?.contains(target);
            const outsideDropdown = !dropdownRef.current?.contains(target);
            if (outsideButton && outsideDropdown) setOpen(false);
        }
        if (open) document.addEventListener('mousedown', onClickOutside);
        return () => document.removeEventListener('mousedown', onClickOutside);
    }, [open]);

    const currentManager = managers.find((m) => m.id === currentManagerId);

    const handleSelect = async (manager: UserListItem) => {
        if (manager.id === currentManagerId) { setOpen(false); return; }
        setSaving(true);
        setOpen(false);
        try {
            await updateStageHistoryManager(runId, stageHistoryId, manager.id);
            onUpdated({ id: manager.id, name: manager.name });
            toast.success(`Manager updated to ${manager.name}`);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to update manager');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="inline-block">
            {/* Trigger pill */}
            <button
                ref={buttonRef}
                onClick={handleToggle}
                disabled={saving}
                title="Change manager for this stage"
                className={`
                    inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium
                    transition-all border
                    ${saving
                        ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-wait'
                        : 'border-blue-100 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:border-blue-300 cursor-pointer'
                    }
                `}
            >
                {saving
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <UserPen className="w-3 h-3 opacity-70" />
                }
                <span>{currentManager?.name ?? 'Unknown'}</span>
                {!saving && (
                    <ChevronDown className={`w-3 h-3 opacity-60 transition-transform ${open ? 'rotate-180' : ''}`} />
                )}
            </button>

            {/* Fixed-position dropdown — escapes any overflow container */}
            {open && (
                <div
                    ref={dropdownRef}
                    style={{
                        position: 'fixed',
                        top: dropdownPos.top,
                        left: dropdownPos.left,
                        zIndex: 9999,
                    }}
                    className="min-w-[180px] bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden"
                >
                    <div className="px-2 py-1.5 border-b border-gray-100">
                        <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                            Select Manager
                        </span>
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                        {managers.map((m) => (
                            <button
                                key={m.id}
                                onClick={() => handleSelect(m)}
                                className={`
                                    w-full text-left px-3 py-2 text-xs transition-colors
                                    ${m.id === currentManagerId
                                        ? 'bg-blue-50 text-blue-700 font-semibold'
                                        : 'text-gray-700 hover:bg-gray-50'
                                    }
                                `}
                            >
                                {m.name}
                                {!m.isActive && (
                                    <span className="ml-1 text-gray-400">(inactive)</span>
                                )}
                            </button>
                        ))}
                        {managers.length === 0 && (
                            <div className="px-3 py-2 text-xs text-gray-400 italic">
                                No managers found
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
export default function RunLifecycleHistory({ runId }: RunLifecycleHistoryProps) {
    const [history, setHistory] = useState<HistoryEntry[] | null>(null);
    const [managers, setManagers] = useState<UserListItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);

        Promise.all([getRunById(runId), listUsers()])
            .then(([run, users]) => {
                if (cancelled) return;
                // Sort chronologically (oldest first); backend also returns asc now.
                const sorted = [...(run.lifecycleHistory ?? [])].sort(
                    (a: HistoryEntry, b: HistoryEntry) =>
                        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
                );
                setHistory(sorted);
                setManagers(users.filter((u) => u.role === 'MANAGER'));
            })
            .catch((err) => {
                console.error('Failed to load run lifecycle history:', err);
                if (!cancelled) setHistory([]);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => { cancelled = true; };
    }, [runId]);

    const handleManagerUpdated = (index: number, newManager: { id: string; name: string }) => {
        setHistory((prev) => {
            if (!prev) return prev;
            const next = [...prev];
            next[index] = { ...next[index], manager: newManager };
            return next;
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-4">
                <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            </div>
        );
    }

    if (!history || history.length === 0) return null;

    return (
        <div className="mb-4 bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
            {/* Header */}
            <div className="px-4 py-2 border-b border-gray-200 bg-gray-100/60 flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-gray-500" />
                <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">
                    Lifecycle Timeline
                </span>
            </div>

            {/* Steps */}
            <div className="divide-y divide-gray-100">
                {history.map((h, i) => {
                    const isCompleted = !!h.completedAt;
                    const hasHistory = !!h.stageHistoryId;

                    return (
                        <div
                            key={i}
                            className={`flex items-start justify-between gap-4 px-4 py-3 text-xs ${
                                isCompleted ? 'bg-white' : 'bg-amber-50/40'
                            }`}
                        >
                            {/* LEFT — stage name + manager */}
                            <div className="flex items-start gap-2 min-w-0">
                                <div className="mt-0.5 flex-shrink-0">
                                    {isCompleted
                                        ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                                        : <div className="w-3.5 h-3.5 rounded-full border-2 border-amber-400 bg-amber-50" />
                                    }
                                </div>

                                <div className="min-w-0">
                                    <span className="font-semibold text-gray-800 block">
                                        {getStatusDisplayName(h.statusCode)}
                                    </span>

                                    {/* Manager — editable pill if history record exists */}
                                    <div className="mt-1">
                                        {hasHistory && h.stageHistoryId ? (
                                            <ManagerDropdown
                                                runId={runId}
                                                stageHistoryId={h.stageHistoryId}
                                                currentManagerId={h.manager?.id ?? null}
                                                managers={managers}
                                                onUpdated={(nm) => handleManagerUpdated(i, nm)}
                                            />
                                        ) : h.manager ? (
                                            <span className="text-blue-600 font-medium">
                                                by {h.manager.name}
                                            </span>
                                        ) : null}
                                    </div>
                                </div>
                            </div>

                            {/* RIGHT — timestamps */}
                            <div className="text-right text-gray-400 flex-shrink-0">
                                <div className="text-[11px]">{formatDate(h.createdAt)}</div>
                                {h.completedAt && (
                                    <div className="text-green-600 text-[11px] mt-0.5">
                                        ✓ {formatDate(h.completedAt)}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
