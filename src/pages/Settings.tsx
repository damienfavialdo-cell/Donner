import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { useI18n } from '@/i18n';
import {
  Info, User, HardDrive, Mail, Settings2, Save, Check
} from 'lucide-react';

type SettingsTab = 'system' | 'profile' | 'backup' | 'email' | 'config';

export default function Settings() {
  const { tenant, tenantRole, user } = useAuth();
  const { t, lang, setLang, langs, langNames } = useI18n();
  const [activeTab, setActiveTab] = useState<SettingsTab>('system');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileData, setProfileData] = useState({
    name: 'Admin MADE',
    email: user?.email || 'madecme711@gmail.com',
    phone: '',
  });
  const [emailConfig, setEmailConfig] = useState({
    reportEmail: 'pdg@ong-made.org',
    autoReport: true,
    reportTime: '18:00',
  });
  const [systemConfig, setSystemConfig] = useState({
    orgName: tenant?.name || 'MADE',
    maxMembers: tenant?.max_members || 500,
    language: lang,
  });

  async function handleSaveProfile() {
    setSaving(true);
    setError(null);
    try {
      const { error: err } = await supabase.auth.updateUser({ email: profileData.email });
      if (err) throw err;
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function handleSaveEmail() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleSaveConfig() {
    if (systemConfig.language !== lang) setLang(systemConfig.language as 'mg' | 'fr' | 'en' | 'it');
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const tabs: { key: SettingsTab; icon: any; label: string }[] = [
    { key: 'system', icon: Info, label: t('systemInfo') },
    { key: 'profile', icon: User, label: t('editProfile') },
    { key: 'backup', icon: HardDrive, label: t('fileBackup') },
    { key: 'email', icon: Mail, label: t('emailManagement') },
    { key: 'config', icon: Settings2, label: t('systemConfig') },
  ];

  return (
    <div>
      <div className="mb-6"><h1 className="text-2xl font-bold text-slate-900">{t('settings')}</h1></div>

      {error && <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>}
      {saved && <div className="mb-4 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700 flex items-center gap-2"><Check className="w-4 h-4" /> {t('success')}</div>}

      <div className="flex gap-1 mb-6 overflow-x-auto pb-2">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                isActive ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}>
              <Icon className="w-4 h-4" /> {tab.label}
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        {activeTab === 'system' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">{t('systemInfo')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-xs text-slate-500 uppercase font-semibold mb-1">{t('organization')}</p>
                <p className="text-sm font-medium text-slate-900">{tenant?.name || 'MADE'}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-xs text-slate-500 uppercase font-semibold mb-1">{t('plan')}</p>
                <p className="text-sm font-medium text-slate-900 capitalize">{tenant?.plan || 'free'}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-xs text-slate-500 uppercase font-semibold mb-1">{t('memberLimit')}</p>
                <p className="text-sm font-medium text-slate-900">{tenant?.max_members || 500}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-xs text-slate-500 uppercase font-semibold mb-1">{t('language')}</p>
                <p className="text-sm font-medium text-slate-900">{langNames[lang]}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-xs text-slate-500 uppercase font-semibold mb-1">{t('role')}</p>
                <p className="text-sm font-medium text-slate-900 capitalize">{tenantRole || 'admin'}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Version</p>
                <p className="text-sm font-medium text-slate-900">ONG MADE v1.0.0</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">{t('editProfile')}</h2>
            <div className="space-y-3 max-w-md">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('name')}</label>
                <input type="text" value={profileData.name} onChange={e => setProfileData({ ...profileData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('email')}</label>
                <input type="email" value={profileData.email} onChange={e => setProfileData({ ...profileData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('phone')}</label>
                <input type="tel" value={profileData.phone} onChange={e => setProfileData({ ...profileData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <button onClick={handleSaveProfile} disabled={saving}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium rounded-xl transition-all">
                <Save className="w-4 h-4" /> {saving ? t('pleaseWait') : t('save')}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'backup' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">{t('fileBackup')}</h2>
            <p className="text-sm text-slate-600">Export all data as JSON for backup purposes.</p>
            <button onClick={async () => {
              try {
                const tables = ['persons', 'attendance', 'events', 'badges', 'cantine_logs', 'gargote_logs', 'medical_records', 'presence', 'suivi_personnel', 'suivi_mere', 'suivi_enfant', 'suivi_beneficiaire', 'suivi_salaire', 'suivi_medicament', 'suivi_cantine', 'suivi_gargote'];
                const backup: Record<string, any[]> = {};
                for (const table of tables) {
                  const { data } = await supabase.from(table).select('*').eq('tenant_id', tenant?.id);
                  backup[table] = data || [];
                }
                const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `ong-made-backup-${new Date().toISOString().split('T')[0]}.json`;
                a.click();
                URL.revokeObjectURL(url);
                setSaved(true);
                setTimeout(() => setSaved(false), 2000);
              } catch (err: any) {
                setError(err.message || 'Backup failed');
              }
            }}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl transition-all">
              <HardDrive className="w-4 h-4" /> {t('download')} Backup
            </button>
          </div>
        )}

        {activeTab === 'email' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">{t('emailManagement')}</h2>
            <div className="space-y-3 max-w-md">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('autoReport')} - {t('sendToPdg')}</label>
                <input type="email" value={emailConfig.reportEmail} onChange={e => setEmailConfig({ ...emailConfig, reportEmail: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('time')}</label>
                <input type="time" value={emailConfig.reportTime} onChange={e => setEmailConfig({ ...emailConfig, reportTime: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={emailConfig.autoReport} onChange={e => setEmailConfig({ ...emailConfig, autoReport: e.target.checked })}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                {t('autoReport')} {t('daily')} {t('sendToPdg')}
              </label>
              <button onClick={handleSaveEmail}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl transition-all">
                <Save className="w-4 h-4" /> {t('save')}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'config' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">{t('systemConfig')}</h2>
            <div className="space-y-3 max-w-md">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('organization')}</label>
                <input type="text" value={systemConfig.orgName} onChange={e => setSystemConfig({ ...systemConfig, orgName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('memberLimit')}</label>
                <input type="number" value={systemConfig.maxMembers} onChange={e => setSystemConfig({ ...systemConfig, maxMembers: parseInt(e.target.value) || 500 })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('language')}</label>
                <select value={systemConfig.language} onChange={e => setSystemConfig({ ...systemConfig, language: e.target.value as 'mg' | 'fr' | 'en' | 'it' })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                  {langs.map(l => <option key={l} value={l}>{langNames[l]}</option>)}
                </select>
              </div>
              <button onClick={handleSaveConfig}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl transition-all">
                <Save className="w-4 h-4" /> {t('save')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


