import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/i18n';
import { supabase } from '@/lib/supabase';
import {
  LayoutDashboard, ScanLine, ClipboardCheck, Users, Calendar,
  ClipboardList, FileBarChart, CreditCard, Bell, Settings, LogOut,
  Building2, Menu, X, UtensilsCrossed, Coffee, Heart, Shield,
  Download, Globe, Target, UserCheck
} from 'lucide-react';
import { useState, useEffect } from 'react';

export default function Layout() {
  const { tenant, signOut, tenantRole, user } = useAuth();
  const { t, lang, setLang, langNames, langs } = useI18n();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: t('dashboard') },
    { to: '/scanner', icon: ScanLine, label: t('scanner') },
    { to: '/manual-attendance', icon: ClipboardCheck, label: t('pointageManuel') },
    { to: '/persons', icon: Users, label: t('personnel') },
    { to: '/presence', icon: UserCheck, label: t('presence') },
    { to: '/suivi', icon: Target, label: t('suivi') },
    { to: '/cantine', icon: UtensilsCrossed, label: t('cantines') },
    { to: '/gargote', icon: Coffee, label: t('gargote') },
    { to: '/attendance', icon: ClipboardList, label: t('attendance') },
    { to: '/events', icon: Calendar, label: t('events') },
    { to: '/reports', icon: FileBarChart, label: t('reports') },
    { to: '/badges', icon: CreditCard, label: t('badges') },
    { to: '/notifications', icon: Bell, label: t('notifications') },
    { to: '/medical', icon: Heart, label: t('medical') },
    { to: '/export', icon: Download, label: t('export') },
    { to: '/audit', icon: Shield, label: t('audit') },
    { to: '/settings', icon: Settings, label: t('settings') },
  ];

  useEffect(() => {
    if (!tenant || !user) return;
    const tid = tenant.id;
    const uid = user.id;

    async function loadUnread() {
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tid)
        .eq('user_id', uid)
        .eq('read', false);
      setUnreadCount(count || 0);
    }

    loadUnread();
    const interval = setInterval(loadUnread, 30000);
    return () => clearInterval(interval);
  }, [tenant, user]);

  async function handleSignOut() {
    await signOut();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white transform transition-transform lg:transform-none ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="flex items-center gap-3 px-6 py-5 border-b border-white/10">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-lg leading-tight">ONG MADE</h1>
            <p className="text-xs text-slate-400 truncate">{tenant?.name || 'Loading...'}</p>
          </div>
          <button className="ml-auto lg:hidden text-slate-400" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="px-3 py-3 space-y-0.5 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/dashboard'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`
              }
            >
              <item.icon className="w-4 h-4" />
              <span className="flex-1 truncate">{item.label}</span>
              {item.label === t('notifications') && unreadCount > 0 && (
                <span className="px-1.5 py-0.5 text-xs font-bold bg-red-500 text-white rounded-full min-w-[18px] text-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 border-t border-white/10">
          <div className="px-4 py-2 flex items-center gap-2">
            <Globe className="w-4 h-4 text-slate-500" />
            <select value={lang} onChange={e => setLang(e.target.value as any)}
              className="bg-transparent text-xs text-slate-400 border-none focus:outline-none cursor-pointer">
              {langs.map(l => (
                <option key={l} value={l} className="bg-slate-900 text-white">{langNames[l]}</option>
              ))}
            </select>
          </div>

          <div className="px-4 py-1.5">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {tenant?.plan?.toUpperCase() || 'FREE'}
            </span>
            <span className="ml-2 text-xs text-slate-500">{tenantRole || ''}</span>
          </div>
          <div className="px-3 pb-3">
            <button onClick={handleSignOut}
              className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/5 transition-all">
              <LogOut className="w-4 h-4" /> {t('signOut')}
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <header className="lg:hidden sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
          <button onClick={() => setSidebarOpen(true)} className="text-slate-600">
            <Menu className="w-6 h-6" />
          </button>
          <h1 className="font-bold text-slate-900">ONG MADE</h1>
          {unreadCount > 0 && (
            <span className="ml-auto px-1.5 py-0.5 text-xs font-bold bg-red-500 text-white rounded-full">{unreadCount}</span>
          )}
        </header>
        <div className="p-4 lg:p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}


