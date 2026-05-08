import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import {
  Users,
  Calendar,
  ClipboardList,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  CreditCard,
  Bell,
} from 'lucide-react';

interface Stats {
  totalPersons: number;
  activeEvents: number;
  todayEntries: number;
  todayExits: number;
}

interface ActivityRecord {
  id: string;
  person_name: string;
  direction: 'entry' | 'exit';
  scanned_at: string;
}

export default function Dashboard() {
  const { tenant } = useAuth();
  const [stats, setStats] = useState<Stats>({
    totalPersons: 0,
    activeEvents: 0,
    todayEntries: 0,
    todayExits: 0,
  });
  const [activity, setActivity] = useState<ActivityRecord[]>([]);
  const [notificationCount, setNotificationCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    if (!tenant) return;
    const tid = tenant.id;

    try {
      const today = new Date().toISOString().slice(0, 10);

      const [personsRes, eventsRes, attendanceRes] = await Promise.all([
        supabase
          .from('persons')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tid)
          .eq('active', true),
        supabase
          .from('events')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tid)
          .eq('status', 'active'),
        supabase
          .from('attendance')
          .select('id, direction, scanned_at, person_id')
          .eq('tenant_id', tid)
          .gte('scanned_at', today),
      ]);

      const attendanceRows = attendanceRes.data || [];
      setStats({
        totalPersons: personsRes.count || 0,
        activeEvents: eventsRes.count || 0,
        todayEntries: attendanceRows.filter((a: any) => a.direction === 'entry').length,
        todayExits: attendanceRows.filter((a: any) => a.direction === 'exit').length,
      });

      // Recent activity: last 5 attendance records with person name
      const { data: recentAttendance } = await supabase
        .from('attendance')
        .select('id, direction, scanned_at, person_id')
        .eq('tenant_id', tid)
        .order('scanned_at', { ascending: false })
        .limit(5);

      const personIds = [...new Set((recentAttendance || []).map((a: any) => a.person_id).filter(Boolean))];
      const personMap: Record<string, string> = {};

      if (personIds.length > 0) {
        const { data: persons } = await supabase
          .from('persons')
          .select('id, first_name, last_name')
          .in('id', personIds);
        (persons || []).forEach((p: any) => {
          personMap[p.id] = `${p.first_name} ${p.last_name}`;
        });
      }

      setActivity(
        (recentAttendance || []).map((a: any) => ({
          id: a.id,
          person_name: personMap[a.person_id] || 'Unknown',
          direction: a.direction,
          scanned_at: a.scanned_at,
        })),
      );

      // Notification count (unread)
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tid)
        .eq('read', false);
      setNotificationCount(count || 0);
    } catch {
      // keep default state
    }
    setLoading(false);
  }, [tenant]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const statsCards = [
    {
      label: 'Total Persons',
      value: stats.totalPersons,
      icon: Users,
      color: 'emerald',
      href: '/persons',
    },
    {
      label: 'Active Events',
      value: stats.activeEvents,
      icon: Calendar,
      color: 'blue',
      href: '/events',
    },
    {
      label: 'Today Entries',
      value: stats.todayEntries,
      icon: ArrowUpRight,
      color: 'teal',
      href: '/attendance',
    },
    {
      label: 'Today Exits',
      value: stats.todayExits,
      icon: ArrowDownRight,
      color: 'amber',
      href: '/attendance',
    },
  ];

  const quickActions = [
    { label: 'Scan Barcode', icon: ClipboardList, href: '/scanner', bg: 'bg-emerald-50 hover:bg-emerald-100', iconColor: 'text-emerald-600', textColor: 'text-emerald-700' },
    { label: 'Manage Persons', icon: Users, href: '/persons', bg: 'bg-blue-50 hover:bg-blue-100', iconColor: 'text-blue-600', textColor: 'text-blue-700' },
    { label: 'Manage Events', icon: Calendar, href: '/events', bg: 'bg-teal-50 hover:bg-teal-100', iconColor: 'text-teal-600', textColor: 'text-teal-700' },
    { label: 'View Reports', icon: ClipboardList, href: '/reports', bg: 'bg-purple-50 hover:bg-purple-100', iconColor: 'text-purple-600', textColor: 'text-purple-700' },
    { label: 'Generate Badges', icon: CreditCard, href: '/badges', bg: 'bg-amber-50 hover:bg-amber-100', iconColor: 'text-amber-600', textColor: 'text-amber-700' },
  ];

  const colorMap: Record<string, { bg: string; icon: string; text: string }> = {
    emerald: { bg: 'bg-emerald-50', icon: 'bg-emerald-100 text-emerald-600', text: 'text-emerald-700' },
    blue: { bg: 'bg-blue-50', icon: 'bg-blue-100 text-blue-600', text: 'text-blue-700' },
    teal: { bg: 'bg-teal-50', icon: 'bg-teal-100 text-teal-600', text: 'text-teal-700' },
    amber: { bg: 'bg-amber-50', icon: 'bg-amber-100 text-amber-600', text: 'text-amber-700' },
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-slate-200 rounded w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 bg-slate-200 rounded-2xl" />
          ))}
        </div>
        <div className="h-48 bg-slate-200 rounded-2xl" />
        <div className="h-40 bg-slate-200 rounded-2xl" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 mt-1">Welcome back to {tenant?.name || 'your organization'}</p>
        </div>
        <a href="/notifications" className="relative p-2.5 rounded-xl hover:bg-slate-100 transition-colors">
          <Bell className="w-5 h-5 text-slate-500" />
          {notificationCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-5 h-5 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full">
              {notificationCount > 9 ? '9+' : notificationCount}
            </span>
          )}
        </a>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map(card => {
          const c = colorMap[card.color];
          return (
            <a
              key={card.label}
              href={card.href}
              className={`${c.bg} rounded-2xl p-5 hover:shadow-md transition-all group`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`w-10 h-10 rounded-xl ${c.icon} flex items-center justify-center`}>
                  <card.icon className="w-5 h-5" />
                </div>
                <TrendingUp className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
              </div>
              <p className={`text-3xl font-bold ${c.text}`}>{card.value}</p>
              <p className="text-sm text-slate-500 mt-1">{card.label}</p>
            </a>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="mt-8 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {quickActions.map(action => (
            <a
              key={action.label}
              href={action.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${action.bg}`}
            >
              <action.icon className={`w-5 h-5 ${action.iconColor}`} />
              <span className={`text-sm font-medium ${action.textColor}`}>{action.label}</span>
            </a>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="mt-8 bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Recent Activity</h2>
          <a href="/attendance" className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">
            View all
          </a>
        </div>

        {activity.length === 0 ? (
          <div className="py-12 text-center">
            <ClipboardList className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-500 text-sm">No recent activity</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {activity.map(record => {
              const isEntry = record.direction === 'entry';
              const DirectionIcon = isEntry ? ArrowUpRight : ArrowDownRight;
              const dirColor = isEntry ? 'text-emerald-600 bg-emerald-50' : 'text-amber-600 bg-amber-50';
              const dirLabel = isEntry ? 'Entry' : 'Exit';

              return (
                <li key={record.id} className="px-6 py-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${dirColor}`}>
                      <DirectionIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">{record.person_name}</p>
                      <p className="text-xs text-slate-400">{dirLabel}</p>
                    </div>
                  </div>
                  <span className="text-xs text-slate-400">
                    {new Date(record.scanned_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}


