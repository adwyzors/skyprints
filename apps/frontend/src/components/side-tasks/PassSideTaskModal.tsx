'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ArrowRight, X } from 'lucide-react';
import { SideTask, SideTaskStageType } from '@/types/sideTask';
import { listStageTypes, passSideTaskStage } from '@/services/sideTaskService';
import { listUsers, UserListItem } from '@/services/usersService';

interface PassSideTaskModalProps {
  task: SideTask | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function PassSideTaskModal({
  task,
  isOpen,
  onClose,
  onSuccess,
}: PassSideTaskModalProps) {
  const [loading, setLoading] = useState(false);
  const [stageTypes, setStageTypes] = useState<SideTaskStageType[]>([]);
  const [users, setUsers] = useState<UserListItem[]>([]);

  const [nextStageTypeId, setNextStageTypeId] = useState('');
  const [nextAssigneeId, setNextAssigneeId] = useState('');
  const [completionNote, setCompletionNote] = useState('');

  useEffect(() => {
    if (!isOpen || !task) return;

    async function loadData() {
      try {
        const [types, userList] = await Promise.all([
          listStageTypes(),
          listUsers(),
        ]);
        const activeUsers = userList.filter((u) => u.isActive);
        setStageTypes(types);
        setUsers(activeUsers);

        // Filter out current stage if possible
        const remainingTypes = types.filter((t) => t.id !== task?.currentStageTypeId);
        if (remainingTypes.length > 0) {
          setNextStageTypeId(remainingTypes[0].id);
        } else if (types.length > 0) {
          setNextStageTypeId(types[0].id);
        }

        if (activeUsers.length > 0) {
          setNextAssigneeId(activeUsers[0].id);
        }
      } catch (err) {
        toast.error('Failed to load stage option data');
      }
    }

    loadData();
  }, [isOpen, task]);

  if (!isOpen || !task) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nextStageTypeId) {
      toast.error('Please select the next stage type');
      return;
    }
    if (!nextAssigneeId) {
      toast.error('Please select the assignee for the next stage');
      return;
    }

    setLoading(true);
    try {
      await passSideTaskStage(task.id, {
        nextStageTypeId,
        nextAssigneeId,
        completionNote: completionNote.trim() || undefined,
      });

      toast.success('Task passed to next stage successfully');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to pass stage');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-blue-900 to-indigo-900 text-white">
          <div className="flex items-center gap-2">
            <ArrowRight className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-semibold">Pass Stage - {task.code}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
              Next Stage Type <span className="text-red-500">*</span>
            </label>
            <select
              value={nextStageTypeId}
              onChange={(e) => setNextStageTypeId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm bg-white"
            >
              {stageTypes.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
              Assignee for Next Stage <span className="text-red-500">*</span>
            </label>
            <select
              value={nextAssigneeId}
              onChange={(e) => setNextAssigneeId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm bg-white"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
              Completion Note
            </label>
            <textarea
              rows={3}
              value={completionNote}
              onChange={(e) => setCompletionNote(e.target.value)}
              placeholder="Notes or handoff remarks for the next stage..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm resize-none"
            />
          </div>

          <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm disabled:opacity-50 transition"
            >
              {loading ? 'Passing...' : 'Pass Stage'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
