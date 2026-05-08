import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { useI18n } from '@/i18n';
import type { Person } from '@/lib/types';
import {
  Coffee,
  Plus,
  Search,
  Trash2,
  Calendar,
} from 'lucide-react';

interface GargoteEntry {
  id: string;
  tenant_id: string;
  person_id: string;
  participation_date: string;
  notes: string;
  created_at: string;
  person?: { first_name: string; last_name: string } | null;
}

export default function Gargote() {
  const { tenant, tenantRole } = useAuth();
  const { t } = useI18n();
  const isAdmin = tenantRole ? ['owner', 'admin'].includes(tenantRole) : false;

  const [entries, setEntries] = useState<GargoteEntry[]>([]);
  const [persons, setPersons] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterDate, setFilterDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({
    person_id: '',
    participation_date: new Date().toISOString().split('T')[0],
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    try {
      const [entryRes, personRes] = await Promise.all([
        supabase
          .from('gargote')
          .select(
            'id, tenant_id, person_id, participation_date, notes, created_at, ' +
              'person:persons(first_name, last_name)'
          )
          .eq('tenant_id', tenant.id)
          .order('participation_date', { ascending: false })
          .limit(500),
        supabase
          .from('persons')
          .select('id, first_name, last_name, category, active')
          .eq('tenant_id', tenant.id)
          .eq('active', true)
          .order('first_name', { ascending: true }),
      ]);

      if (entryRes.error) throw entryRes.error;
      if (personRes.error) throw personRes.error;

      setEntries((entryRes.data || []) as unknown as GargoteEntry[]);
      setPersons((personRes.data || []) as Person[]);
    } catch (err) {
      console.error('Failed to load gargote data:', err);
    }
    setLoading(false);
  }, [tenant]);

  useEffect(() => {
    if (!tenant) return;
    loadData();
  }, [tenant, loadData]);

  function getPersonName(entry: GargoteEntry): string {
    if (entry.person) {
      return `${entry.person.first_name} ${entry.person.last_name}`;
    }
    const p = persons.find((p) => p.id === entry.person_id);
    if (p) return `${p.first_name} ${p.last_name}`;
    return 'Unknown';
  }

  const filtered = entries.filter((e) => {
    if (filterDate && e.participation_date !== filterDate) return false;
    if (search) {
      const name = getPersonName(e).toLowerCase();
      const term = search.toLowerCase();
      if (!name.includes(term) && !e.notes?.toLowerCase().includes(term)) return false;
    }
    return true;
  });

  const todayEntries = entries.filter(
    (e) => e.participation_date === new Date().toISOString().split('T')[0]
  );
  const todayTotal = todayEntries.length;

  async function handleAdd() {
    if (!tenant || !addForm.person_id) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('gargote').insert({
        tenant_id: tenant.id,
        person_id: addForm.person_id,
        participation_date: addForm.participation_date,
        notes: addForm.notes,
      });
      if (error) throw error;
      setShowAddForm(false);
      setAddForm({
        person_id: '',
        participation_date: new Date().toISOString().split('T')[0],
        notes: '',
      });
      await loadData();
    } catch (err) {
      console.error('Failed to add gargote entry:', err);
    }
    setSubmitting(false);
  }

  async function handleDelete(id: string) {
    if (!tenant) return;
    if (!confirm(`${t('areYouSure')} ${t('thisActionCannot')}`)) return;
    try {
      const { error } = await supabase
        .from('gargote')
        .delete()
        .eq('id', id)
        .eq('tenant_id', tenant.id);
      if (error) throw error;
      await loadData();
    } catch (err) {
      console.error('Failed to delete gargote entry:', err);
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">{t('gargote')}</h1>
        <p className="text-slate-500 mt-1">{t('suivi')}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <div className="text-sm text-slate-500">{t('total')} {t('today')}</div>
          <div className="text-2xl font-bold text-slate-900">{todayTotal}</div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        {/* Filters */}
        <div className="p-4 border-b border-slate-100 flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('search') + '...'}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            {/* Date filter */}
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            {/* Add button */}
            {isAdmin && (
              <button
                onClick={() => setShowAddForm(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                {t('add')}
              </button>
            )}
          </div>
        </div>

        {/* Add form */}
        {showAddForm && isAdmin && (
          <div className="p-4 border-b border-slate-100 bg-slate-50">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <select
                value={addForm.person_id}
                onChange={(e) => setAddForm({ ...addForm, person_id: e.target.value })}
                className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">{t('name')}...</option>
                {persons.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.first_name} {p.last_name}
                  </option>
                ))}
              </select>

              <input
                type="date"
                value={addForm.participation_date}
                onChange={(e) => setAddForm({ ...addForm, participation_date: e.target.value })}
                className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />

              <input
                type="text"
                value={addForm.notes}
                onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })}
                placeholder={t('notes') + '...'}
                className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />

              <div className="flex gap-2">
                <button
                  onClick={handleAdd}
                  disabled={submitting || !addForm.person_id}
                  className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? t('pleaseWait') : t('save')}
                </button>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2.5 bg-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-300 transition-colors"
                >
                  {t('cancel')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="p-8 text-center text-slate-400">{t('loading')}</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center">
            <Coffee className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">{t('noData')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                    {t('name')}
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                    {t('date')}
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                    {t('notes')}
                  </th>
                  {isAdmin && (
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase w-10"></th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">
                      {getPersonName(e)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {e.participation_date}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500 max-w-xs truncate">
                      {e.notes || '—'}
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleDelete(e.id)}
                          className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
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


