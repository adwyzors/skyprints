import { useAuth } from '@/auth/AuthProvider';
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut';
import { useRouter } from 'next/navigation';

/**
 * Global navigation keyboard shortcuts hook
 * F2 -> My Tasks
 * F3 -> Orders Tab
 * F4 -> Run Activity
 * (F5 left untouched - native browser refresh)
 * F6 -> Rate Confirmation
 * (F7 left untouched)
 * F8 -> Billing Ready
 * F9 -> Bills
 * F10 -> Reports
 * Ctrl+O -> Create Order Modal
 * Ctrl+/ -> Create Task Modal
 */
export function useNavigationShortcuts() {
  const router = useRouter();
  const { user } = useAuth();

  // Ctrl+O or Cmd+O -> Create Order modal/page
  useKeyboardShortcut(
    'ctrl+o',
    () => {
      router.push('/admin/orders?create=true');
    },
    { ignoreInputFields: false }
  );
  useKeyboardShortcut(
    'mod+o',
    () => {
      router.push('/admin/orders?create=true');
    },
    { ignoreInputFields: false }
  );

  // Ctrl+/ or Cmd+/ -> Open Create Side Task Modal globally from any screen
  useKeyboardShortcut(
    'ctrl+/',
    () => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('open-create-side-task'));
      }
    },
    { ignoreInputFields: false }
  );

  useKeyboardShortcut(
    'mod+/',
    () => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('open-create-side-task'));
      }
    },
    { ignoreInputFields: false }
  );

  // F2 -> Open My Tasks
  useKeyboardShortcut(
    'f2',
    () => {
      const role = user?.user?.role || (user as any)?.role;
      if (role === 'MANAGER') {
        router.push('/manager/runs');
      } else {
        router.push('/admin/my-tasks');
      }
    },
    { ignoreInputFields: false }
  );

  // F3 -> Open Orders Tab
  useKeyboardShortcut(
    'f3',
    () => {
      router.push('/admin/orders');
    },
    { ignoreInputFields: false }
  );

  // F4 -> Open Run Activity
  useKeyboardShortcut(
    'f4',
    () => {
      if (user?.user?.role === 'MANAGER') {
        router.push('/manager/runs');
      } else {
        router.push('/admin/runs');
      }
    },
    { ignoreInputFields: false }
  );

  // F6 -> Rate Confirmation
  useKeyboardShortcut(
    'f6',
    () => {
      router.push('/admin/billing');
    },
    { ignoreInputFields: false }
  );

  // F8 -> Billing Ready
  useKeyboardShortcut(
    'f8',
    () => {
      router.push('/admin/completed');
    },
    { ignoreInputFields: false }
  );

  // F9 -> Bills
  useKeyboardShortcut(
    'f9',
    () => {
      router.push('/admin/bills');
    },
    { ignoreInputFields: false }
  );

  // F10 -> Reports
  useKeyboardShortcut(
    'f10',
    () => {
      router.push('/admin/reports');
    },
    { ignoreInputFields: false }
  );
}
