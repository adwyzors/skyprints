'use client';

import { useAuth } from '@/auth/AuthProvider';
import {
  AppNotification,
  fetchNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from '@/services/notifications.service';
import { Bell, Check, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

export default function NotificationBell() {
  const { user } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Notifications are only for Admin/Super Admin
  const isAdmin = user?.user?.role === 'ADMIN' || user?.user?.role === 'SUPER_ADMIN';

  const loadNotifications = async (showLoading = false) => {
    if (!isAdmin) return;
    if (showLoading) setLoading(true);
    try {
      const data = await fetchNotifications();
      setNotifications(data);
      const unread = data.filter((n) => !n.isRead).length;
      setUnreadCount(unread);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;

    // Load initially
    loadNotifications(true);

    // Poll every 30 seconds for new notifications
    const interval = setInterval(() => {
      loadNotifications(false);
    }, 30000);

    return () => clearInterval(interval);
  }, [isAdmin]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isAdmin) return null;

  const handleNotificationClick = async (notif: AppNotification) => {
    setIsOpen(false);
    
    // Mark as read in background if unread
    if (!notif.isRead) {
      // Optimistic UI update
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      try {
        await markNotificationAsRead(notif.id);
      } catch (err) {
        console.error('Failed to mark notification as read:', err);
      }
    }

    // Navigate to Rate Confirmation search page
    router.push(`/admin/billing?search=${encodeURIComponent(notif.orderCode)}`);
  };

  const handleMarkAllRead = async () => {
    if (unreadCount === 0 || markingAll) return;
    setMarkingAll(true);
    try {
      await markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
      toast.success('All notifications marked as read');
    } catch (err) {
      toast.error('Failed to mark all as read');
    } finally {
      setMarkingAll(false);
    }
  };

  const formatTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const diffMs = Date.now() - date.getTime();
      const diffMin = Math.floor(diffMs / 60000);
      const diffHr = Math.floor(diffMin / 600);
      
      if (diffMin < 1) return 'Just now';
      if (diffMin < 60) return `${diffMin}m ago`;
      if (diffHr < 24) return `${Math.floor(diffMin / 60)}h ago`;
      return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    } catch {
      return '';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded-xl transition-all"
        title="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Overlay */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl border border-gray-200 shadow-xl py-3 z-50 flex flex-col max-h-[480px] animate-in fade-in slide-in-from-top-3 duration-200">
          {/* Header */}
          <div className="px-4 pb-3 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
            <div>
              <h3 className="font-bold text-gray-900 text-sm">Notifications</h3>
              <p className="text-xs text-gray-500">Rate confirmations ready</p>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                disabled={markingAll}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-semibold disabled:opacity-50 transition-colors"
              >
                {markingAll ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1 scrollbar-hide py-1">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                <p className="text-xs text-gray-400 mt-2 font-medium">Loading notifications...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-full mb-3">
                  <Bell className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-gray-700">All caught up!</p>
                <p className="text-xs text-gray-400 mt-1">No notifications generated yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {notifications.map((notif) => (
                  <button
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-gray-50 transition-colors ${
                      !notif.isRead ? 'bg-blue-50/20' : ''
                    }`}
                  >
                    {/* Unread circle */}
                    <div className="flex-shrink-0 mt-1.5">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          !notif.isRead ? 'bg-blue-600' : 'bg-transparent'
                        }`}
                      />
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 font-medium break-words leading-relaxed">
                        {notif.message}
                      </p>
                      <span className="text-[10px] text-gray-400 font-bold block mt-1">
                        {formatTime(notif.createdAt)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
