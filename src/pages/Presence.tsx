import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { useI18n } from '@/i18n';
import type { Person } from '@/lib/types';
import { ClipboardCheck, Search, Plus, RefreshCw, X, Filter } from 'lucide-react';

export default function Presence() {
  const { tenant, tenantRole } = useAuth();
  const { t } = useI18n();
  const [persons, setPersons] = useState<Person[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterGroup, setFilterGroup] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [formData, setFormData] = useState<Record<string, any>>({});

  const isAdmin = tenantRole ? ['owner', 'admin'].includes(tenantRole) : false;

  const loadPersons = useCallback(async () => {
    if (!tenant) return;
    const { data } = await supabase.from('persons').select('*').eq('tenant_id', tenant.id).eq('active', true).order('last_name');
    setPersons((data || []) as Person[]);
  }, [tenant]);

  const loadRecords = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    setError(null);
    try {
      let query = supabase.from('presence').select('*').eq('tenant_id', tenant.id).order('presence_date', { ascending: false }).limit(500);
      if (filterDate) query = query.eq('presence_date', filterDate);
      if (filterGroup) query = query.eq('group_name', filterGroup);
      if (filterStatus) query = query.eq('status', filterStatus);
      const { data, error: err } = await query;
      if (err) throw err;
      setRecords(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [tenant, filterDate, filterGroup, filterStatus]);

  useEffect(() => { loadPersons(); }, [loadPersons]);
  useEffect(() => { loadRecords(); }, [loadRecords]);

  function getPersonName(personId: string) {
    const p = persons.find(x => x.id === personId);
    return p ? `${p.first_name} ${p.last_name}` : 'Unknown';
  }

  function getPersonCategory(personId: string) {
    const p = persons.find(x => x.id === personId);
    return p?.category || '';
  }

  async function handleSave() {
    if (!tenant || !isAdmin) return;
    setError(null);
    try {
      const { error: err } = await supabase.from('presence').insert({
        ...formData,
        tenant_id: tenant.id,
        presence_date: formData.presence_date || filterDate,
      });
      if (err) throw err;
      setShowForm(false);
      setFormData({});
      await loadRecords();
    } catch (err: any) {
      setError(err.message || 'Save failed');
    }
  }

  async function handleStatusChange(id: string, newStatus: string) {
    if (!tenant || !isAdmin) return;
    setError(null);
    try {
      const { error: err } = await supabase.from('presence').update({ status: newStatus }).eq('id', id);
      if (err) throw err;
      await loadRecords();
    } catch (err: any) {
      setError(err.message || 'Update failed');
    }
  }

  async function handleDelete(id: string) {
    if (!tenant || !isAdmin) return;
    setError(null);
    try {
      const { error: err } = await supabase.from('presence').delete().eq('id', id);
      if (err) throw err;
      await loadRecords();
    } catch (err: any) {
      setError(err.message || 'Delete failed');
    }
  }

  const filtered = search
    ? records.filter(r => getPersonName(r.person_id).toLowerCase().includes(search.toLowerCase()))
    : records;

  const presentCount = records.filter(r => r.status === 'present').length;
  const absentCount = records.filter(r => r.status === 'absent').length;
  const retardCount = records.filter(r => r.status === 'retard').length;

  const groups = [...new Set(records.map(r => r.group_name).filter(Boolean))];

  const statusColor = (s: string) => {
    switch (s) {
      case 'present': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'absent': return 'bg-red-50 text-red-700 border-red-200';
      case 'retard': return 'bg-amber-50 text-amber-700 border-amber-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('presence')}</h1>
          <p className="text-slate-500 mt-1">{filterDate}</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button onClick={() => { setFormData({ status: 'present', presence_date: filterDate }); setShowForm(true); }}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl transition-all shadow-sm">
              <Plus className="w-4 h-4" /> {t('add')}
            </button>
          )}
          <button onClick={loadRecords} className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-center">
          <p className="text-2xl font-bold text-emerald-700">{presentCount}</p>
          <p className="text-xs text-emerald-600 font-medium">{t('present')}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-center">
          <p className="text-2xl font-bold text-red-700">{absentCount}</p>
          <p className="text-xs text-red-600 font-medium">{t('absent')}</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-center">
          <p className="text-2xl font-bold text-amber-700">{retardCount}</p>
          <p className="text-xs text-amber-600 font-medium">{t('retard')}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder={`${t('search')}...`}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
        </div>
        <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
          className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        <select value={filterGroup} onChange={e => setFilterGroup(e.target.value)}
          className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
          <option value="">{t('group')} - {t('all')}</option>
          {groups.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
          <option value="">{t('status')} - {t('all')}</option>
          <option value="present">{t('present')}</option>
          <option value="absent">{t('absent')}</option>
          <option value="retard">{t('retard')}</option>
        </select>
      </div>

      {/* Add Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">{t('add')} {t('presence')}</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('name')}</label>
                <select value={formData.person_id || ''} onChange={e => setFormData({ ...formData, person_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                  <option value="">-- Select --</option>
                  {persons.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name} ({p.category})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t('status')}</label>
                  <select value={formData.status || 'present'} onChange={e => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                    <option value="present">{t('present')}</option>
                    <option value="absent">{t('absent')}</option>
                    <option value="retard">{t('retard')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t('group')}</label>
                  <input type="text" value={formData.group_name || ''} onChange={e => setFormData({ ...formData, group_name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('date')}</label>
                <input type="date" value={formData.presence_date || filterDate} onChange={e => setFormData({ ...formData, presence_date: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('notes')}</label>
                <textarea value={formData.notes || ''} onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" rows={2} />
              </div>
            </div>
            <div className="flex items-center gap-3 mt-6">
              <button onClick={handleSave} className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl transition-all">{t('save')}</button>
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition-all">{t('cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">{t('loading')}</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center">
            <ClipboardCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">{t('noData')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{t('name')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{t('category')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{t('group')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{t('status')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{t('date')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{t('notes')}</th>
                  {isAdmin && <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">{t('actions')}</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{getPersonName(r.person_id)}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 capitalize">{getPersonCategory(r.person_id)}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{r.group_name || '-'}</td>
                    <td className="px-4 py-3">
                      <select value={r.status} onChange={e => handleStatusChange(r.id, e.target.value)}
                        disabled={!isAdmin}
                        className={`px-2 py-1 rounded-lg text-xs font-medium border ${statusColor(r.status)} focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-100`}>
                        <option value="present">{t('present')}</option>
                        <option value="absent">{t('absent')}</option>
                        <option value="retard">{t('retard')}</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{r.presence_date}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{r.notes || '-'}</td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => handleDelete(r.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}


