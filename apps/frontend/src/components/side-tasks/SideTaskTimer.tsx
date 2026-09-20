'use client';

import { Clock, PauseCircle, PlayCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

interface SideTaskTimerProps {
  storedTotalTime: number;
  lastStartedAt: string | null;
  pausedAt: string | null;
  status: string;
  size?: 'sm' | 'md' | 'lg';
}

function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hrs > 0) {
    return `${hrs}h ${mins}m ${secs}s`;
  }
  return `${mins}m ${secs}s`;
}

export function SideTaskTimer({
  storedTotalTime,
  lastStartedAt,
  pausedAt,
  status,
  size = 'md',
}: SideTaskTimerProps) {
  const isRunning = Boolean(lastStartedAt && !pausedAt && status === 'IN_PROGRESS');
  const isPaused = Boolean(pausedAt && status === 'IN_PROGRESS');

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

  const textClasses =
    size === 'sm'
      ? 'text-xs'
      : size === 'lg'
        ? 'text-lg font-bold'
        : 'text-sm font-semibold';

  if (isRunning) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <span className={`${textClasses} font-mono`}>{formatDuration(currentSeconds)}</span>
      </div>
    );
  }

  if (isPaused) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
        <PauseCircle className="w-3.5 h-3.5 text-amber-600" />
        <span className={`${textClasses} font-mono`}>{formatDuration(currentSeconds)}</span>
        <span className="text-[10px] uppercase tracking-wider font-semibold opacity-75">Paused</span>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
      <Clock className="w-3.5 h-3.5 text-gray-400" />
      <span className={`${textClasses} font-mono`}>{formatDuration(currentSeconds)}</span>
    </div>
  );
}
