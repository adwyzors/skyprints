'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { UserCheck, X } from 'lucide-react';
import { SideTask } from '@/types/sideTask';
import { reassignSideTaskStage } from '@/services/sideTaskService';
import { listUsers, UserListItem } from '@/services/usersService';

interface ReassignSideTaskModalProps {
  task: SideTask | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ReassignSideTaskModal({
  task,
  isOpen,
  onClose,
  onSuccess,
}: ReassignSideTaskModalProps) {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [newAssigneeId, setNewAssigneeId] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!isOpen || !task) return;

    async function loadUsers() {
      try {
        const userList = await listUsers();
        const activeUsers = userList.filter((u) => u.isActive && u.id !== task?.currentAssigneeId);
        setUsers(activeUsers);
        if (activeUsers.length > 0) {
          setNewAssigneeId(activeUsers[0].id);
        }
      } catch (err) {
        toast.error('Failed to load users');
      }
    }

    loadUsers();
  }, [isOpen, task]);

  if (!isOpen || !task) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAssigneeId) {
      toast.error('Please select a new assignee');
      return;
    }

    setLoading(true);
    try {
      await reassignSideTaskStage(task.id, {
        newAssigneeId,
        reason: reason.trim() || undefined,
      });

      toast.success('Stage reassigned successfully');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reassign stage');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-purple-900 to-indigo-900 text-white">
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-semibold">Reassign Task - {task.code}</h2>
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
              New Assignee <span className="text-red-500">*</span>
            </label>
            <select
              value={newAssigneeId}
              onChange={(e) => setNewAssigneeId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm bg-white"
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
              Reassignment Reason
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for changing assignee..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm resize-none"
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
              className="px-5 py-2 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm disabled:opacity-50 transition"
            >
              {loading ? 'Reassigning...' : 'Reassign Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
