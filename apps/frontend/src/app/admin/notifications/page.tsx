'use client';

import { withAuth } from '@/auth/withAuth';
import Pagination from '@/components/common/Pagination';
import {
    AppNotification,
    fetchNotificationsPage,
    markAllNotificationsAsRead,
    markNotificationAsRead,
    resolveNotificationTarget,
} from '@/services/notifications.service';
import { ArrowRight, Bell, Check, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

const PAGE_SIZE = 20;

function NotificationsPageWrapper() {
    const router = useRouter();
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [currentPage, setCurrentPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [markingAll, setMarkingAll] = useState(false);

    useEffect(() => {
        let cancelled = false;
        async function load() {
            setLoading(true);
            try {
                const data = await fetchNotificationsPage(currentPage, PAGE_SIZE);
                if (!cancelled) {
                    setNotifications(data.notifications);
                    setTotal(data.total);
                    setTotalPages(data.totalPages);
                }
            } catch (err) {
                console.error('Failed to load notifications', err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        load();
        return () => { cancelled = true; };
    }, [currentPage]);

    const handleNotificationClick = async (notif: AppNotification) => {
        if (!notif.isRead) {
            setNotifications((prev) =>
                prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n)),
            );
            try {
                await markNotificationAsRead(notif.id);
            } catch (err) {
                console.error('Failed to mark notification as read:', err);
            }
        }

        const target = resolveNotificationTarget(notif);
        if (target.blockedMessage) {
            toast.info(target.blockedMessage);
        } else {
            router.push(target.path);
        }
    };

    const handleMarkAllRead = async () => {
        if (markingAll) return;
        setMarkingAll(true);
        try {
            await markAllNotificationsAsRead();
            setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
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
            return date.toLocaleString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            });
        } catch {
            return '';
        }
    };

    return (
        <div className="bg-gray-50/50 min-h-full">
            {/* Toolbar */}
            <div className="px-4 py-4 border-b border-gray-200 bg-white/80 backdrop-blur-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg border border-blue-100">
                        <Bell className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Notifications</h1>
                        <p className="text-sm text-gray-500">{total} total &mdash; newest first</p>
                    </div>
                </div>
                <button
                    onClick={handleMarkAllRead}
                    disabled={markingAll}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors shadow-sm text-sm disabled:opacity-50"
                >
                    {markingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Mark all read
                </button>
            </div>

            {/* List */}
            <div className="p-4">
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    {loading ? (
                        <div className="divide-y divide-gray-100">
                            {[...Array(6)].map((_, i) => (
                                <div key={i} className="px-4 py-4 animate-pulse">
                                    <div className="h-4 bg-gray-100 rounded w-3/4 mb-2" />
                                    <div className="h-3 bg-gray-100 rounded w-1/4" />
                                </div>
                            ))}
                        </div>
                    ) : notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                            <div className="p-3 bg-blue-50 text-blue-600 rounded-full mb-3">
                                <Bell className="w-6 h-6" />
                            </div>
                            <p className="text-sm font-semibold text-gray-700">All caught up!</p>
                            <p className="text-xs text-gray-400 mt-1">No notifications generated yet.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {notifications.map((notif) => (
                                <div
                                    key={notif.id}
                                    className={`px-4 py-4 flex items-center gap-4 hover:bg-gray-50/50 transition-colors ${!notif.isRead ? 'bg-blue-50/20' : ''
                                        }`}
                                >
                                    <div className="flex-shrink-0">
                                        <div className={`w-2 h-2 rounded-full ${!notif.isRead ? 'bg-blue-600' : 'bg-transparent'}`} />
                                    </div>
                                    <button
                                        onClick={() => handleNotificationClick(notif)}
                                        className="flex-1 min-w-0 text-left"
                                    >
                                        <p className="text-sm text-gray-800 font-medium break-words leading-relaxed">
                                            {notif.message}
                                        </p>
                                        <span className="text-xs text-gray-400 font-medium block mt-1">
                                            {formatTime(notif.createdAt)}
                                        </span>
                                    </button>
                                    <button
                                        onClick={() => handleNotificationClick(notif)}
                                        className="flex-shrink-0 flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 border border-blue-100 rounded-lg px-3 py-1.5 transition-colors"
                                    >
                                        View Order {notif.orderCode}
                                        <ArrowRight className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                    totalItems={total}
                    pageSize={PAGE_SIZE}
                    itemLabel="notifications"
                />
            </div>
        </div>
    );
}

export default withAuth(NotificationsPageWrapper);
