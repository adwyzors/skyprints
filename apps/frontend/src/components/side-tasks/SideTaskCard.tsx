'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock,
  History,
  Image as ImageIcon,
  Pause,
  Play,
  Send,
  User,
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

interface SideTaskCardProps {
  task: SideTask;
  onRefresh: () => void;
  onPass: (task: SideTask) => void;
  onReassign: (task: SideTask) => void;
  onSubmitReview: (task: SideTask) => void;
  onReview: (task: SideTask) => void;
  onOpenHistory: (task: SideTask) => void;
}

export function SideTaskCard({
  task,
  onRefresh,
  onPass,
  onReassign,
  onSubmitReview,
  onReview,
  onOpenHistory,
}: SideTaskCardProps) {
  const { user } = useAuth();
  const [actionLoading, setActionLoading] = useState(false);

  const images = task.images || [];
  const hasImages = images.length > 0;
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isCarouselPaused, setIsCarouselPaused] = useState(false);

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
    if (!hasImages || images.length <= 1 || isCarouselPaused) return;

    const interval = setInterval(() => {
      nextImage();
    }, 4000);

    return () => clearInterval(interval);
  }, [hasImages, images.length, isCarouselPaused, nextImage]);

  const isAssignedToMe = user?.id === task.currentAssigneeId;
  const currentHistory = task.stageHistories?.[task.stageHistories.length - 1];

  const storedTotalTime = currentHistory?.totalTimeSeconds ?? 0;
  const lastStartedAt = currentHistory?.lastStartedAt ?? null;
  const pausedAt = currentHistory?.pausedAt ?? null;

  const isActiveStatus = task.status === 'ASSIGNED' || task.status === 'IN_PROGRESS';
  const isRunning = Boolean(isActiveStatus && lastStartedAt && !pausedAt);
  const isPaused = Boolean(isActiveStatus && pausedAt);
  const isUnstarted = Boolean(isActiveStatus && !lastStartedAt);

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

  const handleAbandon = async (e: React.MouseEvent) => {
    e.stopPropagation();
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

  const priorityColors = {
    LOW: 'bg-gray-100 text-gray-700',
    MEDIUM: 'bg-blue-50 text-blue-700 border-blue-200',
    HIGH: 'bg-orange-50 text-orange-700 border-orange-200',
    URGENT: 'bg-red-50 text-red-700 border-red-200 font-bold',
  };

  const statusColors = {
    ASSIGNED: 'bg-slate-100 text-slate-700',
    IN_PROGRESS: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    IN_REVIEW: 'bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold',
    COMPLETED: 'bg-teal-50 text-teal-700 border-teal-200',
    ABANDONED: 'bg-rose-50 text-rose-700 border-rose-200',
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col justify-between">
      {/* Top Image Banner / Carousel (Just like OrderCard) */}
      <div
        className="relative w-full h-44 bg-gradient-to-br from-gray-100 to-gray-200 overflow-hidden"
        onMouseEnter={() => setIsCarouselPaused(true)}
        onMouseLeave={() => setIsCarouselPaused(false)}
      >
        {hasImages ? (
          <>
            {images.map((img, index) => (
              <img
                key={index}
                src={img}
                alt={`Task ${task.code}`}
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
                  index === currentImageIndex ? 'opacity-100' : 'opacity-0'
                }`}
                loading="lazy"
              />
            ))}

            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={prevImage}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white p-1.5 rounded-full shadow-md transition-all hover:scale-110 z-10"
                  aria-label="Previous image"
                >
                  <ChevronRight className="w-4 h-4 text-gray-800 rotate-180" />
                </button>
                <button
                  type="button"
                  onClick={nextImage}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white p-1.5 rounded-full shadow-md transition-all hover:scale-110 z-10"
                  aria-label="Next image"
                >
                  <ChevronRight className="w-4 h-4 text-gray-800" />
                </button>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/60 text-white px-2 py-0.5 rounded-full text-[10px] font-medium z-10">
                  {currentImageIndex + 1} / {images.length}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 bg-gray-50/50">
            <ImageIcon className="w-10 h-10 mb-1 opacity-30" />
            <span className="text-xs font-medium text-gray-400">No images uploaded</span>
          </div>
        )}
      </div>

      {/* Card Header & Content */}
      <div className="p-4 space-y-3 flex-1">
        {/* Top Row: Code, Badges, Timer */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-gray-500">{task.code}</span>
              <span
                className={`text-[10px] uppercase px-2 py-0.5 rounded border ${
                  priorityColors[task.priority] || 'bg-gray-100'
                }`}
              >
                {task.priority}
              </span>
              <span
                className={`text-[10px] uppercase px-2 py-0.5 rounded border ${
                  statusColors[task.status] || 'bg-gray-100'
                }`}
              >
                {task.status.replace(/_/g, ' ')}
              </span>
            </div>
            <h3 className="font-semibold text-gray-900 text-sm mt-1 line-clamp-1">
              {task.title}
            </h3>
          </div>

          <SideTaskTimer
            storedTotalTime={storedTotalTime}
            lastStartedAt={lastStartedAt}
            pausedAt={pausedAt}
            status={task.status}
          />
        </div>

        {/* Task Description if present */}
        {task.description && (
          <p className="text-xs text-gray-600 line-clamp-2">{task.description}</p>
        )}

        {/* Customer & Dates & Stage info */}
        <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-gray-100">
          <div>
            <span className="text-gray-400 block text-[10px]">Customer</span>
            <span className="font-medium text-gray-800 line-clamp-1">
              {task.customer ? task.customer.name : 'Internal Task'}
            </span>
          </div>
          <div>
            <span className="text-gray-400 block text-[10px]">Current Stage</span>
            <span className="font-medium text-indigo-700 line-clamp-1">
              {currentHistory?.stageType?.name || 'Unassigned'}
            </span>
          </div>
          <div>
            <span className="text-gray-400 block text-[10px]">Assignee</span>
            <span className="font-medium text-gray-800 line-clamp-1">
              {task.currentAssignee?.name || 'Unassigned'}
            </span>
          </div>
          <div>
            <span className="text-gray-400 block text-[10px]">Required By</span>
            <span className="font-mono text-gray-700">
              {task.requiredBy
                ? new Date(task.requiredBy).toLocaleDateString()
                : 'No date'}
            </span>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-2 flex-wrap">
        <button
          onClick={() => onOpenHistory(task)}
          className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-gray-900 transition"
        >
          <History className="w-3.5 h-3.5 text-gray-400" />
          History
        </button>

        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Action: IN_REVIEW Mode */}
          {task.status === 'IN_REVIEW' && (
            <button
              onClick={() => onReview(task)}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg shadow-sm transition"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Review Task
            </button>
          )}

          {/* Action: Assigned to me & IN_PROGRESS / ASSIGNED */}
          {isAssignedToMe && task.status !== 'COMPLETED' && task.status !== 'ABANDONED' && (
            <>
              {isUnstarted && (
                <button
                  onClick={handleStart}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg shadow-sm transition"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Start
                </button>
              )}

              {isRunning && (
                <button
                  onClick={handlePause}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs rounded-lg shadow-sm transition"
                >
                  <Pause className="w-3.5 h-3.5 fill-current" />
                  Pause
                </button>
              )}

              {isPaused && (
                <button
                  onClick={handleResume}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg shadow-sm transition"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Resume
                </button>
              )}

              {task.status === 'IN_PROGRESS' && (
                <>
                  <button
                    onClick={() => onPass(task)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-lg transition"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                    Pass
                  </button>

                  <button
                    onClick={() => onSubmitReview(task)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-medium text-xs rounded-lg transition"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Submit Review
                  </button>
                </>
              )}
            </>
          )}

          {/* Reassign button for privileged users / assignees */}
          {task.status !== 'COMPLETED' && task.status !== 'ABANDONED' && (
            <button
              onClick={() => onReassign(task)}
              title="Reassign Stage"
              className="p-1.5 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition"
            >
              <UserCheck className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
