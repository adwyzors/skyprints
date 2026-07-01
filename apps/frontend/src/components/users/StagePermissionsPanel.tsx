'use client';

import { useEffect, useState } from 'react';
import { Check, Loader2, ListTree, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  getProcessLifecycleStages,
  getProcesses,
} from '@/services/process.service';
import { ProcessSummary } from '@/domain/model/process.model';
import { ProcessLifecycleStage } from '@/services/process.service';
import {
  StagePermissionEntry,
  UserListItem,
  getStagePermissions,
  updateStagePermissions,
} from '@/services/usersService';

interface StagePermissionsPanelProps {
  isOpen: boolean;
  user: UserListItem | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function StagePermissionsPanel({
  isOpen,
  user,
  onClose,
  onSuccess,
}: StagePermissionsPanelProps) {
  const [processes, setProcesses] = useState<ProcessSummary[]>([]);
  const [stagesByProcess, setStagesByProcess] = useState<
    Record<string, ProcessLifecycleStage[]>
  >({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const key = (processId: string, lifecycleStageId: string) =>
    `${processId}::${lifecycleStageId}`;

  useEffect(() => {
    if (!isOpen || !user) return;

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const [procList, assigned] = await Promise.all([
          getProcesses(),
          getStagePermissions(user.id),
        ]);
        if (cancelled) return;

        setProcesses(procList);

        const stageEntries = await Promise.all(
          procList.map(async (p) => [p.id, await getProcessLifecycleStages(p.id)] as const),
        );
        if (cancelled) return;
        setStagesByProcess(Object.fromEntries(stageEntries));

        setSelected(
          new Set(assigned.map((a) => key(a.processId, a.lifecycleStageId))),
        );
      } catch (err) {
        console.error(err);
        toast.error('Failed to load stage permissions');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, user]);

  if (!isOpen || !user) return null;

  const toggle = (processId: string, stageId: string) => {
    const k = key(processId, stageId);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const entries: StagePermissionEntry[] = Array.from(selected).map((k) => {
        const [processId, lifecycleStageId] = k.split('::');
        return { processId, lifecycleStageId };
      });
      await updateStagePermissions(user.id, entries);
      toast.success('Stage permissions updated');
      onSuccess();
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to update stage permissions');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        <div className="bg-blue-600 p-4 text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <ListTree className="w-5 h-5" />
            <div>
              <h2 className="text-base font-bold">Stage Permissions</h2>
              <p className="text-blue-100 text-xs truncate max-w-[180px]">{user.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-white/20">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 py-2 border-b border-gray-100 bg-gray-50 flex-shrink-0">
          <span className="text-xs text-gray-500">{selected.size} stage(s) assigned</span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : (
            processes.map((p) => (
              <div key={p.id}>
                <div className="px-4 py-1.5 bg-gray-50 border-y border-gray-100 text-[10px] font-bold uppercase tracking-wider text-gray-500 sticky top-0 z-10">
                  {p.name}
                </div>
                {(stagesByProcess[p.id] ?? []).map((stage) => {
                  const k = key(p.id, stage.id);
                  const checked = selected.has(k);
                  return (
                    <label
                      key={k}
                      onClick={() => toggle(p.id, stage.id)}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50/40 cursor-pointer border-b border-gray-50"
                    >
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                          checked ? 'bg-blue-600 border-blue-600' : 'border-gray-300 bg-white'
                        }`}
                      >
                        {checked && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <span className="text-xs text-gray-700">{stage.code}</span>
                    </label>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-gray-100 flex gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 font-medium rounded-lg disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || loading}
            className="flex-1 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </>
  );
}
