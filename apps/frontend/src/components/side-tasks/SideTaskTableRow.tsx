'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  ArrowRight,
  CheckCircle2,
  History,
  Image as ImageIcon,
  Pause,
  Play,
  Send,
  UserCheck,
} from 'lucide-react';
import { SideTask } from '@/types/sideTask';
import { SideTaskTimer } from './SideTaskTimer';
import {
  abandonSideTask,
  pauseSideTaskStage,
  resumeSideTaskStage,
  startSideTaskStage,
} from '@/services/sideTaskService';
import { useAuth } from '@/auth/AuthProvider';

interface SideTaskTableRowProps {
  task: SideTask;
  index: number;
  onRefresh: () => void;
  onPass: (task: SideTask) => void;
  onReassign: (task: SideTask) => void;
  onSubmitReview: (task: SideTask) => void;
  onReview: (task: SideTask) => void;
  onOpenHistory: (task: SideTask) => void;
  onPreviewImage?: (url: string) => void;
}

export function SideTaskTableRow({
  task,
  index,
  onRefresh,
  onPass,
  onReassign,
  onSubmitReview,
  onReview,
  onOpenHistory,
  onPreviewImage,
}: SideTaskTableRowProps) {
  const { user } = useAuth();
  const [actionLoading, setActionLoading] = useState(false);

  const isAssignedToMe = user?.id === task.currentAssigneeId;
  const currentHistory = task.stageHistories?.[task.stageHistories.length - 1];

  const storedTotalTime = currentHistory?.totalTimeSeconds ?? 0;
  const lastStartedAt = currentHistory?.lastStartedAt ?? null;
  const pausedAt = currentHistory?.pausedAt ?? null;

  const isActiveStatus = task.status === 'ASSIGNED' || task.status === 'IN_PROGRESS';
  const isRunning = Boolean(isActiveStatus && lastStartedAt && !pausedAt);
  const isPaused = Boolean(isActiveStatus && pausedAt);
  const isUnstarted = Boolean(isActiveStatus && !lastStartedAt);

  const handleStart = async () => {
    setActionLoading(true);
    try {
      await startSideTaskStage(task.id);
      toast.success('Stage timer started');
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to start timer');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePause = async () => {
    setActionLoading(true);
    try {
      await pauseSideTaskStage(task.id);
      toast.success('Stage timer paused');
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to pause timer');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async () => {
    setActionLoading(true);
    try {
      await resumeSideTaskStage(task.id);
      toast.success('Stage timer resumed');
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to resume timer');
    } finally {
      setActionLoading(false);
    }
  };

  const priorityColors = {
    LOW: 'bg-gray-100 text-gray-700 border-gray-200',
    MEDIUM: 'bg-blue-50 text-blue-700 border-blue-200',
    HIGH: 'bg-orange-50 text-orange-700 border-orange-200',
    URGENT: 'bg-red-50 text-red-700 border-red-200 font-bold',
  };

  const statusColors = {
    ASSIGNED: 'bg-slate-100 text-slate-700 border-slate-200',
    IN_PROGRESS: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    IN_REVIEW: 'bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold',
    COMPLETED: 'bg-teal-50 text-teal-700 border-teal-200',
    ABANDONED: 'bg-rose-50 text-rose-700 border-rose-200',
  };

  const images = task.images || [];

  return (
    <tr className="hover:bg-indigo-50/30 transition-colors border-b border-gray-100">
      {/* Index */}
      <td className="px-4 py-3 text-center text-xs font-semibold text-gray-400">
        {index + 1}
      </td>

      {/* Code */}
      <td className="px-4 py-3">
        <span className="font-mono text-xs font-bold text-gray-700">{task.code}</span>
      </td>

      {/* Image Thumbnails */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5 min-w-[80px]">
          {images.length > 0 ? (
            images.map((img, i) => (
              <div
                key={i}
                onClick={() => (onPreviewImage ? onPreviewImage(img) : window.open(img, '_blank'))}
                className="w-9 h-9 rounded-lg border border-gray-200 overflow-hidden cursor-pointer hover:border-indigo-500 hover:scale-105 transition-all relative bg-gray-50 flex-shrink-0 shadow-2xs"
                title="Click to preview image"
              >
                <img src={img} alt={`Task ${task.code}`} className="w-full h-full object-cover" />
              </div>
            ))
          ) : (
            <div className="w-9 h-9 rounded-lg border border-gray-100 bg-gray-50 flex items-center justify-center text-gray-300">
              <ImageIcon className="w-4 h-4 opacity-40" />
            </div>
          )}
        </div>
      </td>

      {/* Title & Description */}
      <td className="px-4 py-3 max-w-xs">
        <div className="font-semibold text-gray-900 text-sm truncate" title={task.title}>
          {task.title}
        </div>
        {task.description && (
          <div className="text-xs text-gray-500 truncate mt-0.5" title={task.description}>
            {task.description}
          </div>
        )}
      </td>

      {/* Customer */}
      <td className="px-4 py-3 text-xs">
        <span className="font-medium text-gray-800">
          {task.customer ? task.customer.name : 'Internal Task'}
        </span>
      </td>

      {/* Current Stage */}
      <td className="px-4 py-3 text-xs">
        <span className="font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
          {currentHistory?.stageType?.name || 'Unassigned'}
        </span>
      </td>

      {/* Assignee */}
      <td className="px-4 py-3 text-xs">
        <span className="font-medium text-gray-800">
          {task.currentAssignee?.name || 'Unassigned'}
        </span>
      </td>

      {/* Priority */}
      <td className="px-4 py-3">
        <span
          className={`text-[10px] uppercase px-2 py-0.5 rounded border ${
            priorityColors[task.priority] || 'bg-gray-100 text-gray-700'
          }`}
        >
          {task.priority}
        </span>
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <span
          className={`text-[10px] uppercase px-2 py-0.5 rounded border ${
            statusColors[task.status] || 'bg-gray-100 text-gray-700'
          }`}
        >
          {task.status.replace(/_/g, ' ')}
        </span>
      </td>

      {/* Timer */}
      <td className="px-4 py-3">
        <SideTaskTimer
          storedTotalTime={storedTotalTime}
          lastStartedAt={lastStartedAt}
          pausedAt={pausedAt}
          status={task.status}
        />
      </td>

      {/* Required By */}
      <td className="px-4 py-3 text-xs font-mono text-gray-600">
        {task.requiredBy ? new Date(task.requiredBy).toLocaleDateString() : '—'}
      </td>

      {/* Actions */}
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1.5">
          {/* Action: IN_REVIEW Mode */}
          {task.status === 'IN_REVIEW' && (
            <button
              onClick={() => onReview(task)}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-md shadow-xs transition"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Review
            </button>
          )}

          {/* Action: Assigned to me & IN_PROGRESS / ASSIGNED */}
          {isAssignedToMe && task.status !== 'COMPLETED' && task.status !== 'ABANDONED' && (
            <>
              {isUnstarted && (
                <button
                  onClick={handleStart}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-md shadow-xs transition"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Start
                </button>
              )}

              {isRunning && (
                <button
                  onClick={handlePause}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs rounded-md shadow-xs transition"
                >
                  <Pause className="w-3.5 h-3.5 fill-current" />
                  Pause
                </button>
              )}

              {isPaused && (
                <button
                  onClick={handleResume}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-md shadow-xs transition"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Resume
                </button>
              )}

              {task.status === 'IN_PROGRESS' && (
                <>
                  <button
                    onClick={() => onPass(task)}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-md transition"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                    Pass
                  </button>

                  <button
                    onClick={() => onSubmitReview(task)}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white font-medium text-xs rounded-md transition"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Submit Review
                  </button>
                </>
              )}
            </>
          )}

          {/* Reassign button */}
          {task.status !== 'COMPLETED' && task.status !== 'ABANDONED' && (
            <button
              onClick={() => onReassign(task)}
              title="Reassign Stage"
              className="p-1.5 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-md transition"
            >
              <UserCheck className="w-4 h-4" />
            </button>
          )}

          {/* History button */}
          <button
            onClick={() => onOpenHistory(task)}
            title="View History"
            className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-md transition"
          >
            <History className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </td>
    </tr>
  );
}
