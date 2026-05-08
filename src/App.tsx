import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { I18nProvider } from '@/i18n';
import { isSupabaseConfigured } from '@/lib/supabase';
import ErrorBoundary from '@/components/ErrorBoundary';
import Auth from '@/components/Auth';
import Layout from '@/components/Layout';
import Dashboard from '@/pages/Dashboard';
import Scanner from '@/pages/Scanner';
import ManualAttendance from '@/pages/ManualAttendance';
import Persons from '@/pages/Persons';
import Events from '@/pages/Events';
import Attendance from '@/pages/Attendance';
import Reports from '@/pages/Reports';
import Badges from '@/pages/Badges';
import Notifications from '@/pages/Notifications';
import Settings from '@/pages/Settings';
import Cantine from '@/pages/Cantine';
import Gargote from '@/pages/Gargote';
import Medical from '@/pages/Medical';
import Audit from '@/pages/Audit';
import Export from '@/pages/Export';
import Suivi from '@/pages/Suivi';
import Presence from '@/pages/Presence';

function ConfigError() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900 mb-2">Configuration Required</h2>
        <p className="text-sm text-slate-500">Supabase environment variables are missing. Please check your .env file.</p>
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-500">Loading session...</p>
      </div>
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}

function RedirectIfAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export default function App() {
  if (!isSupabaseConfigured()) {
    return <ConfigError />;
  }

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <I18nProvider>
            <Routes>
              <Route path="/login" element={<RedirectIfAuth><Auth /></RedirectIfAuth>} />

              <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="scanner" element={<Scanner />} />
                <Route path="manual-attendance" element={<ManualAttendance />} />
                <Route path="persons" element={<Persons />} />
                <Route path="presence" element={<Presence />} />
                <Route path="suivi" element={<Suivi />} />
                <Route path="attendance" element={<Attendance />} />
                <Route path="events" element={<Events />} />
                <Route path="reports" element={<Reports />} />
                <Route path="badges" element={<Badges />} />
                <Route path="notifications" element={<Notifications />} />
                <Route path="settings" element={<Settings />} />
                <Route path="cantine" element={<Cantine />} />
                <Route path="gargote" element={<Gargote />} />
                <Route path="medical" element={<Medical />} />
                <Route path="audit" element={<Audit />} />
                <Route path="export" element={<Export />} />
              </Route>

              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </I18nProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}


