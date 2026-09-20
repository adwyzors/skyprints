'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, RotateCcw, Send, X } from 'lucide-react';
import { SideTask } from '@/types/sideTask';
import {
  approveSideTaskReview,
  sendBackSideTaskReview,
  submitSideTaskReview,
} from '@/services/sideTaskService';
import { listUsers, UserListItem } from '@/services/usersService';

interface ReviewSideTaskModalProps {
  task: SideTask | null;
  mode: 'submit' | 'review';
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ReviewSideTaskModal({
  task,
  mode,
  isOpen,
  onClose,
  onSuccess,
}: ReviewSideTaskModalProps) {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<UserListItem[]>([]);

  const [noteOrReason, setNoteOrReason] = useState('');
  const [sendBackAssigneeId, setSendBackAssigneeId] = useState('');
  const [actionType, setActionType] = useState<'approve' | 'send_back'>('approve');

  useEffect(() => {
    if (!isOpen || !task) return;

    async function loadUsers() {
      try {
        const userList = await listUsers();
        const activeUsers = userList.filter((u) => u.isActive);
        setUsers(activeUsers);
      } catch (err) {
        toast.error('Failed to load users');
      }
    }

    loadUsers();
  }, [isOpen, task]);

  if (!isOpen || !task) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === 'submit') {
      if (!noteOrReason.trim()) {
        toast.error('Completion note is required when submitting for review');
        return;
      }
      setLoading(true);
      try {
        await submitSideTaskReview(task.id, {
          completionNote: noteOrReason.trim(),
        });
        toast.success('Submitted for review successfully');
        onSuccess();
        onClose();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to submit review');
      } finally {
        setLoading(false);
      }
      return;
    }

    // Review Mode (Approve vs Send Back)
    setLoading(true);
    try {
      if (actionType === 'approve') {
        await approveSideTaskReview(task.id);
        toast.success('Side task approved and completed!');
      } else {
        if (!noteOrReason.trim()) {
          toast.error('Reason is required when sending back a task');
          setLoading(false);
          return;
        }
        await sendBackSideTaskReview(task.id, {
          reason: noteOrReason.trim(),
          assignedUserId: sendBackAssigneeId || undefined,
        });
        toast.success('Task sent back for revision');
      }
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to process review');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-slate-900 to-gray-800 text-white">
          <div className="flex items-center gap-2">
            {mode === 'submit' ? (
              <Send className="w-5 h-5 text-emerald-400" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-indigo-400" />
            )}
            <h2 className="text-lg font-semibold">
              {mode === 'submit' ? `Submit for Review - ${task.code}` : `Review Task - ${task.code}`}
            </h2>
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
          {mode === 'review' && (
            <div className="flex rounded-lg bg-gray-100 p-1">
              <button
                type="button"
                onClick={() => setActionType('approve')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition ${
                  actionType === 'approve'
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Approve Task
              </button>
              <button
                type="button"
                onClick={() => setActionType('send_back')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition ${
                  actionType === 'send_back'
                    ? 'bg-white text-amber-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Send Back for Revision
              </button>
            </div>
          )}

          {mode === 'review' && actionType === 'send_back' && (
            <div>
              <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
                Assign Back To (Optional)
              </label>
              <select
                value={sendBackAssigneeId}
                onChange={(e) => setSendBackAssigneeId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-sm bg-white"
              >
                <option value="">Default (Previous Assignee)</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
              {mode === 'submit'
                ? 'Completion Note *'
                : actionType === 'approve'
                  ? 'Approval Note (Optional)'
                  : 'Return Reason *'}
            </label>
            <textarea
              rows={3}
              required={mode === 'submit' || (mode === 'review' && actionType === 'send_back')}
              value={noteOrReason}
              onChange={(e) => setNoteOrReason(e.target.value)}
              placeholder={
                mode === 'submit'
                  ? 'Describe work completed for review...'
                  : actionType === 'approve'
                    ? 'Optional approval comments...'
                    : 'Reason for sending task back...'
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm resize-none"
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
              className={`px-5 py-2 text-sm font-semibold text-white rounded-lg shadow-sm disabled:opacity-50 transition ${
                mode === 'submit' || actionType === 'approve'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-amber-600 hover:bg-amber-700'
              }`}
            >
              {loading
                ? 'Processing...'
                : mode === 'submit'
                  ? 'Submit for Review'
                  : actionType === 'approve'
                    ? 'Approve Task'
                    : 'Send Back'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
