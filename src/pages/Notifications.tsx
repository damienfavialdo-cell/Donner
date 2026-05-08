import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import type { Notification } from '@/lib/types';
import { Bell, BellOff, Check, Trash2, ScanLine, Calendar, AlertTriangle, CheckCheck } from 'lucide-react';

const TYPE_ICONS: Record<Notification['type'], typeof ScanLine> = {
  scan: ScanLine,
  event: Calendar,
  system: AlertTriangle,
};

const TYPE_COLORS: Record<Notification['type'], string> = {
  scan: 'bg-blue-50 text-blue-600',
  event: 'bg-purple-50 text-purple-600',
  system: 'bg-amber-50 text-amber-600',
};

function getDateGroup(dateStr: string): 'Today' | 'Yesterday' | 'Earlier' {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const notifDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (notifDate.getTime() === today.getTime()) return 'Today';
  if (notifDate.getTime() === yesterday.getTime()) return 'Yesterday';
  return 'Earlier';
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  return date.toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

export default function Notifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error: err } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (err) throw err;
      setNotifications(data || []);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    setLoading(true);
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    intervalRef.current = setInterval(loadNotifications, 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [loadNotifications]);

  async function markAsRead(id: string) {
    try {
      const { error: err } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', id);
      if (err) throw err;
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, read: true } : n))
      );
    } catch {
      // silently fail
    }
  }

  async function markAllAsRead() {
    const unread = notifications.filter(n => !n.read);
    if (unread.length === 0) return;
    try {
      const { error: err } = await supabase
        .from('notifications')
        .update({ read: true })
        .in('id', unread.map(n => n.id));
      if (err) throw err;
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch {
      // silently fail
    }
  }

  async function deleteNotification(id: string) {
    try {
      const { error: err } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id);
      if (err) throw err;
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch {
      // silently fail
    }
  }

  const unreadCount = notifications.filter(n => !n.read).length;

  const grouped: Record<string, Notification[]> = {
    Today: [],
    Yesterday: [],
    Earlier: [],
  };

  for (const n of notifications) {
    const group = getDateGroup(n.created_at);
    grouped[group].push(n);
  }

  if (loading) {
    return (
      <div>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
            <p className="text-slate-500 mt-1">Loading...</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="p-8 text-center text-slate-400">Loading...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
            <p className="text-slate-500 mt-1">Error loading notifications</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="p-8 text-center">
            <AlertTriangle className="w-12 h-12 text-red-300 mx-auto mb-3" />
            <p className="text-red-500">{error}</p>
            <button
              onClick={loadNotifications}
              className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl transition-all text-sm"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
          <p className="text-slate-500 mt-1">
            {unreadCount > 0 ? `${unreadCount} unread` : `${notifications.length} total notifications`}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl transition-all shadow-sm"
          >
            <CheckCheck className="w-4 h-4" /> Mark all as read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="p-12 text-center">
            <Bell className="w-16 h-16 text-slate-200 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-1">No notifications yet</h3>
            <p className="text-slate-500">When you receive notifications, they will appear here.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {(['Today', 'Yesterday', 'Earlier'] as const).map(group => {
            const items = grouped[group];
            if (items.length === 0) return null;
            return (
              <div key={group}>
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2 px-1">
                  {group}
                </h2>
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100">
                  {items.map(n => {
                    const Icon = TYPE_ICONS[n.type] || Bell;
                    const colorClass = TYPE_COLORS[n.type] || 'bg-slate-50 text-slate-600';

                    return (
                      <div
                        key={n.id}
                        className={`flex items-start gap-4 px-4 py-3.5 hover:bg-slate-50 transition-colors ${!n.read ? 'bg-emerald-50/40' : ''}`}
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${colorClass}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className={`text-sm font-medium truncate ${!n.read ? 'text-slate-900' : 'text-slate-600'}`}>
                              {n.title}
                            </p>
                            {!n.read && (
                              <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0" />
                            )}
                          </div>
                          <p className="text-sm text-slate-500 line-clamp-2 mt-0.5">{n.message}</p>
                          <p className="text-xs text-slate-400 mt-1">{formatTime(n.created_at)}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {!n.read && (
                            <button
                              onClick={() => markAsRead(n.id)}
                              title="Mark as read"
                              className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => deleteNotification(n.id)}
                            title="Delete notification"
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


