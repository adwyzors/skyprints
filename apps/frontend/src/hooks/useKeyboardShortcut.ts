import { useEffect, useRef } from 'react';

interface ShortcutOptions {
  ignoreInputFields?: boolean; // Avoid firing shortcuts while typing in inputs
}

/**
 * useKeyboardShortcut hook
 * @param shortcut - A representation like "mod+k", "ctrl+shift+s", or "Escape"
 *                   "mod" automatically maps to Cmd on macOS and Ctrl on Windows/Linux.
 * @param callback - Callback to trigger when shortcut matches
 * @param options  - Additional options
 */
export function useKeyboardShortcut(
  shortcut: string,
  callback: (event: KeyboardEvent) => void,
  options: ShortcutOptions = {}
) {
  const { ignoreInputFields = true } = options;
  const callbackRef = useRef(callback);

  // Keep callback ref updated to prevent re-binding closures
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // 1. Guard input fields from triggering shortcuts
      if (ignoreInputFields) {
        const activeEl = document.activeElement;
        if (
          activeEl &&
          (activeEl.tagName === 'INPUT' ||
            activeEl.tagName === 'TEXTAREA' ||
            activeEl.getAttribute('contenteditable') === 'true')
        ) {
          return;
        }
      }

      // 2. Parse the shortcut keys
      const parts = shortcut.toLowerCase().split('+');
      const targetKey = parts[parts.length - 1];

      // Match modifier keys
      const requiresCtrl = parts.includes('ctrl') || parts.includes('control');
      const requiresShift = parts.includes('shift');
      const requiresAlt = parts.includes('alt');
      
      const isMac = typeof window !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);
      const requiresMeta = parts.includes('meta') || parts.includes('cmd') || parts.includes('command') || (parts.includes('mod') && isMac);
      const requiresCtrlOrMeta = parts.includes('mod') && !isMac;

      const hasCtrl = event.ctrlKey;
      const hasShift = event.shiftKey;
      const hasAlt = event.altKey;
      const hasMeta = event.metaKey;

      const ctrlMatch = requiresCtrlOrMeta ? hasCtrl : (requiresCtrl === hasCtrl);
      const metaMatch = requiresMeta === hasMeta;
      const shiftMatch = requiresShift === hasShift;
      const altMatch = requiresAlt === hasAlt;
      const keyMatch = event.key.toLowerCase() === targetKey;

      if (ctrlMatch && metaMatch && shiftMatch && altMatch && keyMatch) {
        event.preventDefault();
        callbackRef.current(event);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [shortcut, ignoreInputFields]);
}
