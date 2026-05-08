import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { useI18n } from '@/i18n';
import type { Person, PersonCategory } from '@/lib/types';
import { Heart, Plus, Search, Pencil, Trash2, X, Save } from 'lucide-react';

interface MedicalRecord {
  id: string;
  tenant_id: string;
  person_id: string;
  visit_date: string;
  diagnosis: string;
  treatment: string | null;
  prescription: string | null;
  doctor_name: string | null;
  notes: string | null;
  created_at: string;
}

interface FormData {
  person_id: string;
  visit_date: string;
  diagnosis: string;
  treatment: string;
  prescription: string;
  doctor_name: string;
  notes: string;
}

const EMPTY_FORM: FormData = {
  person_id: '',
  visit_date: '',
  diagnosis: '',
  treatment: '',
  prescription: '',
  doctor_name: '',
  notes: '',
};

export default function Medical() {
  const { tenant, tenantRole } = useAuth();
  const { t } = useI18n();
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [persons, setPersons] = useState<{id: string; first_name: string; last_name: string; barcode_id: string; category: PersonCategory}[]>([]);
  const [personMap, setPersonMap] = useState<Record<string, {first_name: string; last_name: string}>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<MedicalRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  const canEdit = tenantRole ? ['owner', 'admin'].includes(tenantRole) : false;

  const loadData = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    try {
      const [medRes, personsRes] = await Promise.all([
        supabase
          .from('medical_records')
          .select('*')
          .eq('tenant_id', tenant.id)
          .order('visit_date', { ascending: false }),
        supabase
          .from('persons')
          .select('id, first_name, last_name, barcode_id, category')
          .eq('tenant_id', tenant.id)
          .order('last_name'),
      ]);

      if (medRes.error) throw medRes.error;
      if (personsRes.error) throw personsRes.error;

      setRecords(medRes.data || []);
      setPersons(personsRes.data || []);

      const map: Record<string, {first_name: string; last_name: string}> = {};
      for (const p of personsRes.data || []) {
        map[p.id] = { first_name: p.first_name, last_name: p.last_name };
      }
      setPersonMap(map);
    } catch (err) {
      console.error('Failed to load medical records:', err);
    }
    setLoading(false);
  }, [tenant]);

  useEffect(() => {
    if (!tenant) return;
    loadData();
  }, [tenant, loadData]);

  function getPersonName(personId: string): string {
    const p = personMap[personId];
    if (!p) return '—';
    return `${p.first_name} ${p.last_name}`;
  }

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
    setError(null);
  }

  function openEdit(record: MedicalRecord) {
    setEditing(record);
    setForm({
      person_id: record.person_id,
      visit_date: record.visit_date,
      diagnosis: record.diagnosis,
      treatment: record.treatment || '',
      prescription: record.prescription || '',
      doctor_name: record.doctor_name || '',
      notes: record.notes || '',
    });
    setShowForm(true);
    setError(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!tenant) return;
    setSaving(true);
    setError(null);

    try {
      const payload = {
        person_id: form.person_id,
        visit_date: form.visit_date,
        diagnosis: form.diagnosis,
        treatment: form.treatment || null,
        prescription: form.prescription || null,
        doctor_name: form.doctor_name || null,
        notes: form.notes || null,
      };

      if (editing) {
        const { error: err } = await supabase
          .from('medical_records')
          .update(payload)
          .eq('id', editing.id)
          .eq('tenant_id', tenant.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase
          .from('medical_records')
          .insert({ ...payload, tenant_id: tenant.id });
        if (err) throw err;
      }

      setShowForm(false);
      await loadData();
    } catch (err: any) {
      setError(err.message || t('save_failed'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!tenant) return;
    if (!confirm(t('confirm_delete_record'))) return;
    try {
      const { error: err } = await supabase
        .from('medical_records')
        .delete()
        .eq('id', id)
        .eq('tenant_id', tenant.id);
      if (err) throw err;
      await loadData();
    } catch (err: any) {
      console.error('Failed to delete medical record:', err);
    }
  }

  const filtered = records.filter((r) => {
    if (!search) return true;
    const name = getPersonName(r.person_id).toLowerCase();
    const term = search.toLowerCase();
    return name.includes(term);
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('medical_records')}</h1>
          <p className="text-slate-500 mt-1">{records.length} {t('total_records')}</p>
        </div>
        {canEdit && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" /> {t('add_record')}
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        {/* Search */}
        <div className="p-4 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('search_by_person_name')}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="p-8 text-center text-slate-400">{t('loading')}</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center">
            <Heart className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">{t('no_medical_records')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                    {t('person_name')}
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                    {t('visit_date')}
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                    {t('diagnosis')}
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                    {t('treatment')}
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                    {t('doctor')}
                  </th>
                  {canEdit && (
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase w-20"></th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">
                      {getPersonName(r.person_id)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {new Date(r.visit_date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {r.diagnosis}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {r.treatment || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {r.doctor_name || '—'}
                    </td>
                    {canEdit && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEdit(r)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(r.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowForm(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">
                {editing ? t('edit_record') : t('add_record')}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3">
              {/* Person select */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t('person')}
                </label>
                <select
                  required
                  value={form.person_id}
                  onChange={(e) => setForm({ ...form, person_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  <option value="">{t('select_person')}</option>
                  {persons.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.first_name} {p.last_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Visit date */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t('visit_date')}
                </label>
                <input
                  type="date"
                  required
                  value={form.visit_date}
                  onChange={(e) => setForm({ ...form, visit_date: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>

              {/* Diagnosis */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t('diagnosis')}
                </label>
                <input
                  required
                  value={form.diagnosis}
                  onChange={(e) => setForm({ ...form, diagnosis: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>

              {/* Treatment */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t('treatment')}
                </label>
                <input
                  value={form.treatment}
                  onChange={(e) => setForm({ ...form, treatment: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>

              {/* Prescription */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t('prescription')}
                </label>
                <textarea
                  value={form.prescription}
                  onChange={(e) => setForm({ ...form, prescription: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>

              {/* Doctor name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t('doctor_name')}
                </label>
                <input
                  value={form.doctor_name}
                  onChange={(e) => setForm({ ...form, doctor_name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t('notes')}
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={saving}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" /> {saving ? t('saving') : t('save_record')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


