'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  ArrowRight,
  Check,
  Clock,
  Eye,
  History as HistoryIcon,
  Image as ImageIcon,
  MoreVertical,
  Pause,
  Pencil,
  Play,
  RotateCcw,
  Trash2,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { SideTask } from '@/types/sideTask';
import { useAuth } from '@/auth/AuthProvider';
import {
  abandonSideTask,
  completeSideTask,
  deleteSideTask,
  pauseSideTaskStage,
  resumeSideTaskStage,
  startSideTaskStage,
} from '@/services/sideTaskService';
import {
  getTaskCardTheme,
  PRIORITY_LABELS,
  TASK_TYPE_LABELS,
} from './sideTaskTheme';

interface SideTaskTableRowProps {
  task: SideTask;
  index: number;
  onRefresh: () => void;
  onPass: (task: SideTask) => void;
  onReassign: (task: SideTask) => void;
  onEdit?: (task: SideTask) => void;
  onSubmitReview: (task: SideTask) => void;
  onReview: (task: SideTask) => void;
  onOpenHistory: (task: SideTask) => void;
  onPreviewImage?: (url: string) => void;
}

function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hrs > 0) {
    return `${hrs}h ${mins}m ${secs}s`;
  }
  return `${mins < 10 ? '0' : ''}${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
}

export function SideTaskTableRow({
  task,
  index,
  onRefresh,
  onPass,
  onReassign,
  onEdit,
  onSubmitReview,
  onReview,
  onOpenHistory,
  onPreviewImage,
}: SideTaskTableRowProps) {
  const { user, hasPermission } = useAuth();
  const role = user?.user?.role || (user as any)?.role;
  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';
  const canReview = isAdmin || Boolean(hasPermission?.('side_tasks:review'));

  const [actionLoading, setActionLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const currentHistory = task.stageHistories?.[task.stageHistories.length - 1];
  const storedTotalTime = currentHistory?.totalTimeSeconds ?? 0;
  const lastStartedAt = currentHistory?.lastStartedAt ?? null;
  const pausedAt = currentHistory?.pausedAt ?? null;

  const isActiveStatus = task.status === 'ASSIGNED' || task.status === 'IN_PROGRESS';
  const isRunning = Boolean(isActiveStatus && lastStartedAt && !pausedAt);
  const isPaused = Boolean(isActiveStatus && pausedAt);
  const isOngoing = isRunning || task.status === 'IN_PROGRESS';
  const isInReview = task.status === 'IN_REVIEW';

  const [nowMs, setNowMs] = useState<number>(Date.now());

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning]);

  let currentSeconds = storedTotalTime;
  if (isRunning && lastStartedAt) {
    const elapsed = Math.max(
      0,
      Math.floor((nowMs - new Date(lastStartedAt).getTime()) / 1000),
    );
    currentSeconds += elapsed;
  }

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

  const handleDirectComplete = () => {
    setMenuOpen(false);
    if (isInReview) {
      onReview(task);
    } else {
      onSubmitReview(task);
    }
  };

  const handleAbandon = async () => {
    setMenuOpen(false);
    if (!confirm('Are you sure you want to abandon this task?')) return;
    setActionLoading(true);
    try {
      await abandonSideTask(task.id);
      toast.success('Task abandoned');
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to abandon task');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    setMenuOpen(false);
    if (
      !confirm(
        `Are you sure you want to delete side task "${task.code}"? This will permanently delete it and its images.`,
      )
    )
      return;
    setActionLoading(true);
    try {
      await deleteSideTask(task.id);
      toast.success('Task deleted successfully');
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete task');
    } finally {
      setActionLoading(false);
    }
  };

  const theme = getTaskCardTheme(task.taskType, task.priority);
  const taskTypeLabel = TASK_TYPE_LABELS[task.taskType || 'FIVE_MIN'];
  const priorityLabel = PRIORITY_LABELS[task.priority || 'MEDIUM'];
  const images = task.images || [];

  const typeDotColor =
    task.taskType === 'FIVE_MIN'
      ? 'bg-sky-500'
      : task.taskType === 'HALF_HOUR'
      ? 'bg-amber-500'
      : 'bg-slate-500';

  return (
    <tr
      className={`${theme.bg} border-b border-black/5 transition-colors duration-150 hover:brightness-95`}
    >
      {/* Index */}
      <td
        className={`px-3 py-3 text-center text-xs font-semibold ${
          theme.isDark ? 'text-white/70' : 'text-gray-500'
        }`}
      >
        {index + 1}
      </td>

      {/* Code */}
      <td className="px-3 py-3 whitespace-nowrap">
        <span
          className={`font-mono text-xs font-bold ${
            theme.isDark ? 'text-white' : 'text-gray-900'
          }`}
        >
          {task.code}
        </span>
      </td>

      {/* Thumbnail */}
      <td className="px-3 py-3">
        <div className="flex items-center">
          {images.length > 0 ? (
            <div
              onClick={() => (onPreviewImage ? onPreviewImage(images[0]) : window.open(images[0], '_blank'))}
              className="w-10 h-10 rounded-lg border border-black/10 overflow-hidden cursor-pointer hover:scale-105 transition-all bg-white flex-shrink-0 shadow-2xs relative"
              title="Click to preview image"
            >
              <img src={images[0]} alt={`Task ${task.code}`} className="w-full h-full object-cover" />
              {images.length > 1 && (
                <span className="absolute bottom-0 right-0 bg-black/60 text-white text-[8px] font-bold px-1 rounded-tl">
                  +{images.length - 1}
                </span>
              )}
            </div>
          ) : (
            <div className="w-10 h-10 rounded-lg border border-black/10 bg-white/50 flex items-center justify-center text-gray-400">
              <ImageIcon className="w-4 h-4 opacity-40" />
            </div>
          )}
        </div>
      </td>

      {/* Task title */}
      <td className="px-3 py-3 max-w-xs md:max-w-sm">
        <div
          className={`font-bold text-xs truncate ${
            theme.isDark ? 'text-white' : 'text-gray-900'
          }`}
          title={task.title}
        >
          {task.title}
        </div>
      </td>

      {/* Customer / Stage */}
      <td className="px-3 py-3 whitespace-nowrap text-xs">
        <div
          className={`font-medium ${
            theme.isDark ? 'text-white/80' : 'text-gray-700'
          }`}
        >
          {task.customer ? task.customer.name : 'Internal Task'}
        </div>
        <div
          className={`text-[11px] font-semibold ${
            theme.isDark ? 'text-blue-300' : 'text-blue-600'
          }`}
        >
          {currentHistory?.stageType?.name || 'Design'}
        </div>
      </td>

      {/* Task type */}
      <td className="px-3 py-3 whitespace-nowrap text-xs font-medium">
        <span className={theme.isDark ? 'text-white/90' : 'text-gray-700'}>
          {(task as any).subType ||
            (task as any).category ||
            (task.taskType ? TASK_TYPE_LABELS[task.taskType] : null) ||
            currentHistory?.stageType?.name ||
            'Artwork'}
        </span>
      </td>

      {/* Priority badge */}
      <td className="px-3 py-3 whitespace-nowrap">
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded text-[10px] font-bold tracking-wider ${
            theme.priorityBadge.bg
          } ${theme.priorityBadge.text}`}
        >
          {task.priority || 'MEDIUM'}
        </span>
      </td>

      {/* Status */}
      <td className="px-3 py-3 whitespace-nowrap">
        {task.status === 'IN_PROGRESS' ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            In progress
          </span>
        ) : task.status === 'IN_REVIEW' ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider bg-purple-100 text-purple-700 border border-purple-200">
            IN REVIEW
          </span>
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
            ASSIGNED
          </span>
        )}
      </td>

      {/* Timer */}
      <td className="px-3 py-3 whitespace-nowrap">
        <div
          className={`inline-flex items-center gap-1.5 font-mono text-xs font-semibold ${
            theme.isDark ? 'text-white' : 'text-gray-800'
          }`}
        >
          {isRunning ? (
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
          ) : (
            <span className="w-2 h-2 rounded-full bg-slate-400 inline-block" />
          )}
          <span>{formatDuration(currentSeconds)}</span>
        </div>
      </td>

      {/* Actions */}
      <td className="px-3 py-3 whitespace-nowrap text-right">
        <div className="flex items-center justify-end gap-1.5">
          {isOngoing ? (
            <>
              {isRunning && (
                <button
                  type="button"
                  onClick={handlePause}
                  disabled={actionLoading}
                  className="p-1.5 text-indigo-700 bg-white hover:bg-indigo-50 border border-indigo-300 rounded-lg transition cursor-pointer shadow-2xs"
                  title="Pause timer"
                >
                  <Pause className="w-3.5 h-3.5 fill-indigo-600 text-indigo-600" />
                </button>
              )}

              {isPaused && (
                <button
                  type="button"
                  onClick={handleResume}
                  disabled={actionLoading}
                  className="p-1.5 text-emerald-700 bg-white hover:bg-emerald-50 border border-emerald-400 rounded-lg transition cursor-pointer shadow-2xs"
                  title="Resume timer"
                >
                  <Play className="w-3.5 h-3.5 fill-emerald-600 text-emerald-600" />
                </button>
              )}

              <button
                type="button"
                onClick={() => onSubmitReview(task)}
                disabled={actionLoading}
                className="p-1.5 text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs transition cursor-pointer"
                title="Complete stage & submit for review"
              >
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
            </>
          ) : isInReview ? (
            <>
              {canReview && (
                <button
                  type="button"
                  onClick={() => onReview(task)}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 active:bg-purple-800 rounded-lg shadow-2xs transition cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Review
                </button>
              )}

              {onEdit && (
                <button
                  type="button"
                  onClick={() => onEdit(task)}
                  className="p-1.5 text-gray-500 hover:text-indigo-600 bg-white hover:bg-gray-100 rounded-lg border border-gray-200 transition cursor-pointer shadow-2xs"
                  title="Edit task"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}

              <button
                type="button"
                onClick={() => onOpenHistory(task)}
                className="p-1.5 text-gray-500 hover:text-gray-800 bg-white hover:bg-gray-100 rounded-lg border border-gray-200 transition cursor-pointer shadow-2xs"
                title="View History"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleStart}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-lg shadow-2xs transition cursor-pointer"
              >
                <Play className="w-3 h-3 fill-current" />
                Start
              </button>

              {onEdit && (
                <button
                  type="button"
                  onClick={() => onEdit(task)}
                  className="p-1.5 text-gray-500 hover:text-indigo-600 bg-white hover:bg-gray-100 rounded-lg border border-gray-200 transition cursor-pointer shadow-2xs"
                  title="Edit task"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}

              <button
                type="button"
                onClick={() => onReassign(task)}
                className="p-1.5 text-gray-500 hover:text-indigo-600 bg-white hover:bg-gray-100 rounded-lg border border-gray-200 transition cursor-pointer shadow-2xs"
                title="Reassign stage"
              >
                <UserCheck className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={handleDirectComplete}
                disabled={actionLoading}
                className="p-1.5 text-emerald-600 hover:text-white bg-emerald-50 hover:bg-emerald-600 border border-emerald-200 hover:border-emerald-600 rounded-lg shadow-2xs transition cursor-pointer"
                title="Mark complete directly"
              >
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>

              <button
                type="button"
                onClick={() => onOpenHistory(task)}
                className="p-1.5 text-gray-500 hover:text-gray-800 bg-white hover:bg-gray-100 rounded-lg border border-gray-200 transition cursor-pointer shadow-2xs"
                title="View History"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          {/* More actions dropdown menu */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(!menuOpen);
              }}
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                theme.isDark
                  ? 'text-white/80 hover:text-white hover:bg-white/10'
                  : 'text-gray-400 hover:text-gray-700 hover:bg-black/5'
              }`}
              title="More actions"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 bottom-full mb-1 w-44 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-30 animate-in fade-in zoom-in-95 duration-100 text-left">
                {onEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onEdit(task);
                    }}
                    className="w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2 cursor-pointer font-medium"
                  >
                    <Pencil className="w-3.5 h-3.5 text-indigo-600" />
                    Edit Task
                  </button>
                )}
                {!isInReview && (
                  <button
                    type="button"
                    onClick={handleDirectComplete}
                    className="w-full px-3 py-1.5 text-left text-xs text-emerald-700 hover:bg-emerald-50 flex items-center gap-2 cursor-pointer font-medium"
                  >
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    Submit for Review
                  </button>
                )}
                {isInReview && canReview && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onReview(task);
                    }}
                    className="w-full px-3 py-1.5 text-left text-xs text-purple-700 hover:bg-purple-50 flex items-center gap-2 cursor-pointer font-medium"
                  >
                    <Eye className="w-3.5 h-3.5 text-purple-600" />
                    Review Task
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onPass(task);
                  }}
                  className="w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2 cursor-pointer"
                >
                  <ArrowRight className="w-3.5 h-3.5 text-blue-500" />
                  Pass Stage
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onReassign(task);
                  }}
                  className="w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2 cursor-pointer"
                >
                  <UserCheck className="w-3.5 h-3.5 text-purple-500" />
                  Reassign
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenHistory(task);
                  }}
                  className="w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2 cursor-pointer"
                >
                  <HistoryIcon className="w-3.5 h-3.5 text-gray-400" />
                  View History
                </button>
                <div className="my-1 border-t border-gray-100"></div>
                <button
                  type="button"
                  onClick={handleAbandon}
                  className="w-full px-3 py-1.5 text-left text-xs text-amber-600 hover:bg-amber-50 flex items-center gap-2 cursor-pointer"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  Abandon Task
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="w-full px-3 py-1.5 text-left text-xs text-red-600 hover:bg-red-50 flex items-center gap-2 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Task
                </button>
              </div>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}
