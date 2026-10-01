'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  ArrowRight,
  Check,
  ChevronRight,
  Clock,
  Eye,
  History,
  Image as ImageIcon,
  Maximize2,
  MoreVertical,
  Pause,
  Pencil,
  Play,
  RotateCcw,
  Send,
  Trash2,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { SideTask } from '@/types/sideTask';
import {
  abandonSideTask,
  completeSideTask,
  deleteSideTask,
  pauseSideTaskStage,
  resumeSideTaskStage,
  startSideTaskStage,
} from '@/services/sideTaskService';
import { useAuth } from '@/auth/AuthProvider';
import {
  getTaskCardTheme,
  PRIORITY_LABELS,
  TASK_TYPE_LABELS,
} from './sideTaskTheme';

interface SideTaskCardProps {
  task: SideTask;
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

export function SideTaskCard({
  task,
  onRefresh,
  onPass,
  onReassign,
  onEdit,
  onSubmitReview,
  onReview,
  onOpenHistory,
  onPreviewImage,
}: SideTaskCardProps) {
  const { user } = useAuth();
  const [actionLoading, setActionLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const images = task.images || [];
  const hasImages = images.length > 0;
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const nextImage = useCallback(
    (e?: React.MouseEvent) => {
      if (e) e.stopPropagation();
      setCurrentImageIndex((prev) => (prev + 1) % images.length);
    },
    [images.length],
  );

  const prevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

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
  const isUnstarted = Boolean(isActiveStatus && !lastStartedAt);
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

  const handleStart = async (e: React.MouseEvent) => {
    e.stopPropagation();
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

  const handlePause = async (e: React.MouseEvent) => {
    e.stopPropagation();
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

  const handleResume = async (e: React.MouseEvent) => {
    e.stopPropagation();
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

  return (
    <div className="bg-white rounded-xl border border-gray-200/90 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden relative group">
      {/* Top Image Preview / Carousel */}
      <div className="relative w-full h-40 bg-gray-100 overflow-hidden border-b border-black/5">
        {hasImages ? (
          <>
            <img
              src={images[currentImageIndex]}
              alt={`Task ${task.code}`}
              className="w-full h-full object-cover"
              loading="lazy"
            />

            {/* Expand / Preview Button */}
            <div className="absolute top-2 right-2 flex items-center gap-1.5 z-10">
              {images.length > 1 && (
                <span className="bg-black/50 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-md backdrop-blur-xs">
                  {currentImageIndex + 1}/{images.length}
                </span>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onPreviewImage) {
                    onPreviewImage(images[currentImageIndex]);
                  } else {
                    window.open(images[currentImageIndex], '_blank');
                  }
                }}
                className="bg-black/40 hover:bg-black/70 text-white p-1 rounded-md backdrop-blur-xs transition"
                title="Preview full image"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Carousel navigation arrows */}
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={prevImage}
                  className="absolute left-1.5 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/70 text-white p-1 rounded-full transition opacity-0 group-hover:opacity-100 z-10"
                  aria-label="Previous image"
                >
                  <ChevronRight className="w-3.5 h-3.5 rotate-180" />
                </button>
                <button
                  type="button"
                  onClick={nextImage}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/70 text-white p-1 rounded-full transition opacity-0 group-hover:opacity-100 z-10"
                  aria-label="Next image"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 bg-gray-50">
            <ImageIcon className="w-8 h-8 mb-1 opacity-30" />
            <span className="text-[11px] font-medium text-gray-400">No image</span>
          </div>
        )}
      </div>

      {/* Card Body with Dynamic Background Theme */}
      <div className={`${theme.bg} p-3.5 space-y-2 flex-1 transition-colors duration-200`}>
        {/* Top Badges Row */}
        <div className="flex items-center justify-between gap-1.5">
          <span
            className={`font-mono text-xs font-bold tracking-tight ${
              theme.isDark ? 'text-white' : 'text-gray-900'
            }`}
          >
            {task.code}
          </span>

          <div className="flex items-center gap-1.5">
            {/* Task Type Badge */}
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                theme.typeBadge.bg
              } ${theme.typeBadge.text} ${theme.typeBadge.border || ''}`}
            >
              <Clock className="w-2.5 h-2.5" />
              {taskTypeLabel}
            </span>

            {/* Priority Badge */}
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                theme.priorityBadge.bg
              } ${theme.priorityBadge.text}`}
            >
              {priorityLabel}
            </span>
          </div>
        </div>

        {/* Task Title */}
        <h4
          className={`font-bold text-xs leading-snug line-clamp-2 ${
            theme.isDark ? 'text-white' : 'text-gray-900'
          }`}
          title={task.title}
        >
          {task.title}
        </h4>

        {/* Subtext info */}
        <div className="space-y-0.5 pt-0.5">
          <div
            className={`text-[11px] truncate ${
              theme.isDark ? 'text-white/80' : 'text-gray-600'
            }`}
          >
            {task.customer ? task.customer.name : 'Internal Task'} ·{' '}
            {currentHistory?.stageType?.name || 'Design'}
          </div>
          <div
            className={`text-[11px] truncate flex items-center gap-1 ${
              theme.isDark ? 'text-white/80' : 'text-gray-600'
            }`}
          >
            <span>{task.currentAssignee?.name || 'Unassigned'}</span>
            <span>·</span>
            <span
              className={
                isOngoing
                  ? theme.isDark
                    ? 'text-emerald-300 font-bold'
                    : 'text-emerald-600 font-bold'
                  : 'capitalize'
              }
            >
              {task.status === 'IN_PROGRESS'
                ? 'In progress'
                : task.status === 'ASSIGNED'
                ? 'Assigned'
                : task.status === 'IN_REVIEW'
                ? 'In review'
                : task.status.toLowerCase().replace(/_/g, ' ')}
            </span>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="px-3.5 py-2.5 bg-white border-t border-gray-100 flex items-center justify-between text-xs">
        {isOngoing ? (
          /* Ongoing Task Footer */
          <>
            {/* Live Timer */}
            <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-gray-800">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>{formatDuration(currentSeconds)}</span>
            </div>

            {/* Actions: Pause, Complete, More */}
            <div className="flex items-center gap-1.5">
              {isRunning && (
                <button
                  type="button"
                  onClick={handlePause}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition cursor-pointer"
                >
                  <Pause className="w-3 h-3 fill-current" />
                  Pause
                </button>
              )}

              {isPaused && (
                <button
                  type="button"
                  onClick={handleResume}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition cursor-pointer"
                >
                  <Play className="w-3 h-3 fill-current" />
                  Resume
                </button>
              )}

              <button
                type="button"
                onClick={() => onSubmitReview(task)}
                disabled={actionLoading}
                className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-lg shadow-2xs transition cursor-pointer"
              >
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                Complete
              </button>

              {/* Menu button */}
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(!menuOpen);
                  }}
                  className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition cursor-pointer"
                  title="More actions"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

                {menuOpen && (
                  <div className="absolute right-0 bottom-full mb-1 w-44 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-30 animate-in fade-in zoom-in-95 duration-100">
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
                    <button
                      type="button"
                      onClick={handleDirectComplete}
                      className="w-full px-3 py-1.5 text-left text-xs text-emerald-700 hover:bg-emerald-50 flex items-center gap-2 cursor-pointer font-medium"
                    >
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      Mark Complete
                    </button>
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
                      <History className="w-3.5 h-3.5 text-gray-400" />
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
          </>
        ) : (
          /* Unstarted / Non-ongoing Task Footer */
          <>
            {/* History link */}
            <button
              type="button"
              onClick={() => onOpenHistory(task)}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 hover:text-gray-900 transition cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              History
            </button>

            {/* Timer placeholder or paused time */}
            <div className="text-[11px] text-gray-400 font-mono">
              ⏱ {formatDuration(currentSeconds)}
            </div>

            {/* Actions: Review, Resume, Start, More */}
            <div className="flex items-center gap-1.5">
              {isInReview ? (
                <button
                  type="button"
                  onClick={() => onReview(task)}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 active:bg-purple-800 rounded-lg shadow-2xs transition cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Review
                </button>
              ) : isPaused ? (
                <button
                  type="button"
                  onClick={handleResume}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-lg shadow-2xs transition cursor-pointer"
                >
                  <Play className="w-3 h-3 fill-current" />
                  Resume
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleStart}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1 px-3.5 py-1 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-lg shadow-2xs transition cursor-pointer"
                >
                  <Play className="w-3 h-3 fill-current" />
                  Start
                </button>
              )}

              {/* Submit for Review button (only when not in review) */}
              {!isInReview && (
                <button
                  type="button"
                  onClick={handleDirectComplete}
                  disabled={actionLoading}
                  className="p-1 text-emerald-600 hover:text-white bg-emerald-50 hover:bg-emerald-600 border border-emerald-200 hover:border-emerald-600 rounded-md transition cursor-pointer shadow-2xs"
                  title="Submit for review"
                >
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                </button>
              )}

              {/* Menu button */}
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(!menuOpen);
                  }}
                  className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition cursor-pointer"
                  title="More actions"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

                {menuOpen && (
                  <div className="absolute right-0 bottom-full mb-1 w-44 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-30 animate-in fade-in zoom-in-95 duration-100">
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
                    {isInReview && (
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
          </>
        )}
      </div>
    </div>
  );
}
