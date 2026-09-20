'use client';

import { Clock, History, User, X } from 'lucide-react';
import { SideTask } from '@/types/sideTask';

interface SideTaskHistoryModalProps {
  task: SideTask | null;
  isOpen: boolean;
  onClose: () => void;
}

function formatWorkedTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) return `${hrs}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

function formatTimeOnly(isoString?: string | null): string {
  if (!isoString) return '-';
  const d = new Date(isoString);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function SideTaskHistoryModal({
  task,
  isOpen,
  onClose,
}: SideTaskHistoryModalProps) {
  if (!isOpen || !task) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-gray-900 to-slate-800 text-white">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-400" />
            <div>
              <h2 className="text-base font-semibold">{task.title}</h2>
              <p className="text-xs text-gray-300 font-mono">{task.code}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
            Stage Assignment History
          </h3>

          <div className="space-y-3">
            {task.stageHistories && task.stageHistories.length > 0 ? (
              task.stageHistories.map((h, idx) => (
                <div
                  key={h.id}
                  className="bg-gray-50 rounded-xl p-4 border border-gray-200 flex flex-col gap-2 relative"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="font-semibold text-sm text-gray-900">
                        {h.stageType?.name || 'Stage'}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-gray-600 bg-white px-2 py-0.5 rounded border border-gray-200">
                        <User className="w-3 h-3 text-gray-400" />
                        {h.assignedUser?.name || 'Assigned User'}
                      </span>
                    </div>

                    {h.outcome && (
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                          h.outcome === 'COMPLETED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : h.outcome === 'REASSIGNED'
                              ? 'bg-purple-100 text-purple-800'
                              : h.outcome === 'SUBMITTED_FOR_REVIEW'
                                ? 'bg-blue-100 text-blue-800'
                                : h.outcome === 'RETURNED'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {h.outcome.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-4 gap-2 text-xs text-gray-600 pt-1 border-t border-gray-200/60 mt-1">
                    <div>
                      <span className="text-gray-400 block text-[10px]">Assigned</span>
                      <span className="font-mono">{formatTimeOnly(h.assignedAt)}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px]">Started</span>
                      <span className="font-mono">{formatTimeOnly(h.startedAt)}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px]">Worked Time</span>
                      <span className="font-mono font-semibold text-indigo-600">
                        {formatWorkedTime(h.totalTimeSeconds)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px]">Completed</span>
                      <span className="font-mono">{formatTimeOnly(h.completedAt)}</span>
                    </div>
                  </div>

                  {h.completionNote && (
                    <div className="mt-1 p-2 bg-white rounded border border-gray-200 text-xs text-gray-700">
                      <span className="font-semibold text-gray-500">Note: </span>
                      {h.completionNote}
                    </div>
                  )}

                  {h.reassignmentReason && (
                    <div className="mt-1 p-2 bg-purple-50 rounded border border-purple-200 text-xs text-purple-800">
                      <span className="font-semibold">Reassignment Reason: </span>
                      {h.reassignmentReason}
                    </div>
                  )}

                  {h.reviewReturnReason && (
                    <div className="mt-1 p-2 bg-amber-50 rounded border border-amber-200 text-xs text-amber-800">
                      <span className="font-semibold">Return Reason: </span>
                      {h.reviewReturnReason}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500 italic">No history available.</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-end bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-lg transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
