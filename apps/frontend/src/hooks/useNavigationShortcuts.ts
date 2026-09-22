import { useAuth } from '@/auth/AuthProvider';
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut';
import { useRouter } from 'next/navigation';

/**
 * Global navigation keyboard shortcuts hook
 * F2 -> My Tasks
 * F3 -> Run Activity
 * F4 -> Rate Confirmation
 * F6 -> Billing Ready
 * F8 -> Bills
 * F9 -> Reports
 * Ctrl+O -> Create Order
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
      router.push('/admin/my-tasks');
    },
    { ignoreInputFields: false }
  );

  // F3 -> Open Run Activity
  useKeyboardShortcut(
    'f3',
    () => {
      if (user?.user?.role === 'MANAGER') {
        router.push('/manager/runs');
      } else {
        router.push('/admin/runs');
      }
    },
    { ignoreInputFields: false }
  );

  // F4 -> Rate Confirmation
  useKeyboardShortcut(
    'f4',
    () => {
      router.push('/admin/billing');
    },
    { ignoreInputFields: false }
  );

  // F6 -> Billing Ready
  useKeyboardShortcut(
    'f6',
    () => {
      router.push('/admin/completed');
    },
    { ignoreInputFields: false }
  );

  // F8 -> Bills
  useKeyboardShortcut(
    'f8',
    () => {
      router.push('/admin/bills');
    },
    { ignoreInputFields: false }
  );

  // F9 -> Reports
  useKeyboardShortcut(
    'f9',
    () => {
      router.push('/admin/reports');
    },
    { ignoreInputFields: false }
  );
}
