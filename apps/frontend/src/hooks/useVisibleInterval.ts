import { useEffect, useRef } from 'react';

export interface UseVisibleIntervalOptions {
  /**
   * Whether to trigger the callback immediately when the tab becomes active/visible.
   * Default: true
   */
  immediateOnVisible?: boolean;
  /**
   * Whether the timer is enabled.
   * Default: true
   */
  enabled?: boolean;
}

/**
 * Custom hook that runs a callback periodically ONLY when the browser tab/window is active and visible.
 * Automatically pauses when the tab is hidden or minimized, and optionally triggers an immediate
 * refresh when the user returns to the tab.
 *
 * @param callback The function to execute periodically and on tab focus.
 * @param intervalMs The polling interval in milliseconds (e.g., 20000 for 20s).
 * @param options Configuration options (immediateOnVisible, enabled).
 */
export function useVisibleInterval(
  callback: () => void | Promise<void>,
  intervalMs: number | null,
  options?: UseVisibleIntervalOptions,
) {
  const { immediateOnVisible = true, enabled = true } = options || {};
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled || intervalMs === null || intervalMs <= 0) return;

    let intervalId: ReturnType<typeof setInterval> | null = null;

    const startTimer = () => {
      if (intervalId) clearInterval(intervalId);
      intervalId = setInterval(() => {
        if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
          savedCallback.current();
        }
      }, intervalMs);
    };

    const stopTimer = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const handleVisibilityChange = () => {
      if (typeof document === 'undefined') return;
      if (document.visibilityState === 'visible') {
        if (immediateOnVisible) {
          savedCallback.current();
        }
        startTimer();
      } else {
        stopTimer();
      }
    };

    const handleWindowFocus = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        if (immediateOnVisible) {
          savedCallback.current();
        }
        startTimer();
      }
    };

    // If currently visible when mounted or enabled, start the timer
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      startTimer();
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleWindowFocus);
      window.addEventListener('blur', stopTimer);
    }

    return () => {
      stopTimer();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', handleWindowFocus);
        window.removeEventListener('blur', stopTimer);
      }
    };
  }, [intervalMs, immediateOnVisible, enabled]);
}
