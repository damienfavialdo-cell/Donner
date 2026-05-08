import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { useI18n } from '@/i18n';
import type { Person } from '@/lib/types';
import { Users, Heart, Baby, HandHeart, Banknote, Pill, UtensilsCrossed, Hammer, Search, Plus, RefreshCw, CreditCard as Edit2, Trash2, X } from 'lucide-react';

type SuiviTab = 'personnel' | 'mere' | 'enfant' | 'beneficiaire' | 'salaire' | 'medicament' | 'cantine' | 'gargote';

const tabs: { key: SuiviTab; icon: any; labelKey: string }[] = [
  { key: 'personnel', icon: Users, labelKey: 'suiviPersonnel' },
  { key: 'mere', icon: Heart, labelKey: 'suiviMere' },
  { key: 'enfant', icon: Baby, labelKey: 'suiviEnfant' },
  { key: 'beneficiaire', icon: HandHeart, labelKey: 'suiviBeneficiaire' },
  { key: 'salaire', icon: Banknote, labelKey: 'suiviSalaire' },
  { key: 'medicament', icon: Pill, labelKey: 'suiviMedicament' },
  { key: 'cantine', icon: UtensilsCrossed, labelKey: 'suiviCantine' },
  { key: 'gargote', icon: Hammer, labelKey: 'suiviGargote' },
];

export default function Suivi() {
  const { tenant, tenantRole } = useAuth();
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<SuiviTab>('personnel');
  const [persons, setPersons] = useState<Person[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});

  const isAdmin = tenantRole ? ['owner', 'admin'].includes(tenantRole) : false;

  const loadPersons = useCallback(async () => {
    if (!tenant) return;
    const { data } = await supabase.from('persons').select('*').eq('tenant_id', tenant.id).eq('active', true).order('last_name');
    setPersons((data || []) as Person[]);
  }, [tenant]);

  const tableName = `suivi_${activeTab}` as string;

  const loadRecords = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from(tableName)
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false })
        .limit(200);
      if (err) throw err;
      setRecords(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load records');
    } finally {
      setLoading(false);
    }
  }, [tenant, tableName]);

  useEffect(() => { loadPersons(); }, [loadPersons]);
  useEffect(() => { loadRecords(); }, [loadRecords]);

  function getPersonName(personId: string) {
    const p = persons.find(x => x.id === personId);
    return p ? `${p.first_name} ${p.last_name}` : 'Unknown';
  }

  function resetForm() {
    setShowForm(false);
    setEditingId(null);
    setFormData({});
  }

  async function handleSave() {
    if (!tenant || !isAdmin) return;
    setError(null);
    try {
      if (editingId) {
        const { error: err } = await supabase.from(tableName).update(formData).eq('id', editingId);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from(tableName).insert({ ...formData, tenant_id: tenant.id });
        if (err) throw err;
      }
      resetForm();
      await loadRecords();
    } catch (err: any) {
      setError(err.message || 'Save failed');
    }
  }

  async function handleDelete(id: string) {
    if (!tenant || !isAdmin) return;
    setError(null);
    try {
      const { error: err } = await supabase.from(tableName).delete().eq('id', id);
      if (err) throw err;
      await loadRecords();
    } catch (err: any) {
      setError(err.message || 'Delete failed');
    }
  }

  const filtered = search
    ? records.filter((r: any) => getPersonName(r.person_id).toLowerCase().includes(search.toLowerCase()))
    : records;

  // Form fields per tab
  function renderFormFields() {
    const personOptions = persons.map(p => (
      <option key={p.id} value={p.id}>{p.first_name} {p.last_name} ({p.category})</option>
    ));

    const personSelect = (
      <div key="person_id">
        <label className="block text-sm font-medium text-slate-700 mb-1">{t('name')}</label>
        <select value={formData.person_id || ''} onChange={e => setFormData({ ...formData, person_id: e.target.value })}
          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
          <option value="">-- Select --</option>
          {personOptions}
        </select>
      </div>
    );

    switch (activeTab) {
      case 'personnel':
        return (
          <>
            {personSelect}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('position')}</label>
                <input type="text" value={formData.position || ''} onChange={e => setFormData({ ...formData, position: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('department')}</label>
                <input type="text" value={formData.department || ''} onChange={e => setFormData({ ...formData, department: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('contractType')}</label>
                <input type="text" value={formData.contract_type || ''} onChange={e => setFormData({ ...formData, contract_type: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('salary')}</label>
                <input type="number" value={formData.salary || 0} onChange={e => setFormData({ ...formData, salary: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('contractStart')}</label>
                <input type="date" value={formData.contract_start || ''} onChange={e => setFormData({ ...formData, contract_start: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('contractEnd')}</label>
                <input type="date" value={formData.contract_end || ''} onChange={e => setFormData({ ...formData, contract_end: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('notes')}</label>
              <textarea value={formData.notes || ''} onChange={e => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" rows={2} />
            </div>
          </>
        );

      case 'mere':
        return (
          <>
            {personSelect}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('prenatal')}</label>
                <input type="date" value={formData.prenatal_date || ''} onChange={e => setFormData({ ...formData, prenatal_date: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('postnatal')}</label>
                <input type="date" value={formData.postnatal_date || ''} onChange={e => setFormData({ ...formData, postnatal_date: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('numberOfChildren')}</label>
                <input type="number" value={formData.number_of_children || 0} onChange={e => setFormData({ ...formData, number_of_children: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('supportType')}</label>
                <input type="text" value={formData.support_type || ''} onChange={e => setFormData({ ...formData, support_type: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('healthStatus')}</label>
              <input type="text" value={formData.health_status || ''} onChange={e => setFormData({ ...formData, health_status: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('notes')}</label>
              <textarea value={formData.notes || ''} onChange={e => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" rows={2} />
            </div>
          </>
        );

      case 'enfant':
        return (
          <>
            {personSelect}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('schoolLevel')}</label>
                <input type="text" value={formData.school_level || ''} onChange={e => setFormData({ ...formData, school_level: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('guardian')}</label>
                <input type="text" value={formData.guardian_name || ''} onChange={e => setFormData({ ...formData, guardian_name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('healthStatus')}</label>
                <input type="text" value={formData.health_status || ''} onChange={e => setFormData({ ...formData, health_status: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('nutrition')}</label>
                <input type="text" value={formData.nutrition_status || ''} onChange={e => setFormData({ ...formData, nutrition_status: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('notes')}</label>
              <textarea value={formData.notes || ''} onChange={e => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" rows={2} />
            </div>
          </>
        );

      case 'beneficiaire':
        return (
          <>
            {personSelect}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('program')}</label>
                <input type="text" value={formData.program || ''} onChange={e => setFormData({ ...formData, program: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('aidType')}</label>
                <input type="text" value={formData.aid_type || ''} onChange={e => setFormData({ ...formData, aid_type: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('amount')}</label>
                <input type="number" value={formData.amount || 0} onChange={e => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('status')}</label>
                <select value={formData.status || 'active'} onChange={e => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                  <option value="active">{t('active')}</option>
                  <option value="completed">{t('completed')}</option>
                  <option value="cancelled">{t('cancelled')}</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('startDate')}</label>
                <input type="date" value={formData.start_date || ''} onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('endDate')}</label>
                <input type="date" value={formData.end_date || ''} onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('notes')}</label>
              <textarea value={formData.notes || ''} onChange={e => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" rows={2} />
            </div>
          </>
        );

      case 'salaire':
        return (
          <>
            {personSelect}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('amount')}</label>
                <input type="number" value={formData.amount || 0} onChange={e => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('month')}</label>
                <input type="text" value={formData.month || ''} onChange={e => setFormData({ ...formData, month: e.target.value })} placeholder="2026-05"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('paymentMethod')}</label>
                <select value={formData.payment_method || 'cash'} onChange={e => setFormData({ ...formData, payment_method: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                  <option value="cash">{t('cash')}</option>
                  <option value="transfer">{t('transfer')}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('status')}</label>
                <select value={formData.status || 'pending'} onChange={e => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                  <option value="pending">{t('pending')}</option>
                  <option value="paid">{t('paid')}</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('date')}</label>
              <input type="date" value={formData.payment_date || ''} onChange={e => setFormData({ ...formData, payment_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('notes')}</label>
              <textarea value={formData.notes || ''} onChange={e => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" rows={2} />
            </div>
          </>
        );

      case 'medicament':
        return (
          <>
            {personSelect}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('medication')}</label>
                <input type="text" value={formData.medication_name || ''} onChange={e => setFormData({ ...formData, medication_name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('dosage')}</label>
                <input type="text" value={formData.dosage || ''} onChange={e => setFormData({ ...formData, dosage: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('frequency')}</label>
                <input type="text" value={formData.frequency || ''} onChange={e => setFormData({ ...formData, frequency: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('prescribedBy')}</label>
                <input type="text" value={formData.prescribed_by || ''} onChange={e => setFormData({ ...formData, prescribed_by: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('startDate')}</label>
                <input type="date" value={formData.start_date || ''} onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('endDate')}</label>
                <input type="date" value={formData.end_date || ''} onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('notes')}</label>
              <textarea value={formData.notes || ''} onChange={e => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" rows={2} />
            </div>
          </>
        );

      case 'cantine':
        return (
          <>
            {personSelect}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('mealCount')}</label>
                <input type="number" value={formData.meal_count || 0} onChange={e => setFormData({ ...formData, meal_count: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('mealType')}</label>
                <select value={formData.meal_type || 'lunch'} onChange={e => setFormData({ ...formData, meal_type: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                  <option value="breakfast">{t('breakfast')}</option>
                  <option value="lunch">{t('lunch')}</option>
                  <option value="dinner">{t('dinner')}</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('nutrition')}</label>
                <input type="text" value={formData.nutrition_status || ''} onChange={e => setFormData({ ...formData, nutrition_status: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('date')}</label>
                <input type="date" value={formData.tracking_date || ''} onChange={e => setFormData({ ...formData, tracking_date: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('notes')}</label>
              <textarea value={formData.notes || ''} onChange={e => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" rows={2} />
            </div>
          </>
        );

      case 'gargote':
        return (
          <>
            {personSelect}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('activity')}</label>
                <input type="text" value={formData.activity || ''} onChange={e => setFormData({ ...formData, activity: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('participationCount')}</label>
                <input type="number" value={formData.participation_count || 0} onChange={e => setFormData({ ...formData, participation_count: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('date')}</label>
              <input type="date" value={formData.tracking_date || ''} onChange={e => setFormData({ ...formData, tracking_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('notes')}</label>
              <textarea value={formData.notes || ''} onChange={e => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" rows={2} />
            </div>
          </>
        );
    }
  }

  // Table columns per tab
  function renderRecordRow(r: any) {
    const name = getPersonName(r.person_id);
    const editRecord = () => {
      setEditingId(r.id);
      setFormData({ ...r });
      setShowForm(true);
    };

    switch (activeTab) {
      case 'personnel':
        return (
          <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
            <td className="px-4 py-3 text-sm font-medium text-slate-900">{name}</td>
            <td className="px-4 py-3 text-sm text-slate-600">{r.position}</td>
            <td className="px-4 py-3 text-sm text-slate-600">{r.department}</td>
            <td className="px-4 py-3 text-sm text-slate-600">{r.contract_type}</td>
            <td className="px-4 py-3 text-sm text-slate-600">{r.salary ? `${r.salary} Ar` : '-'}</td>
            <td className="px-4 py-3 text-sm text-slate-600">{r.contract_start || '-'}</td>
            <td className="px-4 py-3 text-right">
              {isAdmin && (
                <div className="flex items-center justify-end gap-1">
                  <button onClick={editRecord} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDelete(r.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              )}
            </td>
          </tr>
        );
      case 'mere':
        return (
          <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
            <td className="px-4 py-3 text-sm font-medium text-slate-900">{name}</td>
            <td className="px-4 py-3 text-sm text-slate-600">{r.prenatal_date || '-'}</td>
            <td className="px-4 py-3 text-sm text-slate-600">{r.postnatal_date || '-'}</td>
            <td className="px-4 py-3 text-sm text-slate-600">{r.number_of_children}</td>
            <td className="px-4 py-3 text-sm text-slate-600">{r.health_status || '-'}</td>
            <td className="px-4 py-3 text-sm text-slate-600">{r.support_type || '-'}</td>
            <td className="px-4 py-3 text-right">
              {isAdmin && (
                <div className="flex items-center justify-end gap-1">
                  <button onClick={editRecord} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDelete(r.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              )}
            </td>
          </tr>
        );
      case 'enfant':
        return (
          <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
            <td className="px-4 py-3 text-sm font-medium text-slate-900">{name}</td>
            <td className="px-4 py-3 text-sm text-slate-600">{r.school_level || '-'}</td>
            <td className="px-4 py-3 text-sm text-slate-600">{r.health_status || '-'}</td>
            <td className="px-4 py-3 text-sm text-slate-600">{r.nutrition_status || '-'}</td>
            <td className="px-4 py-3 text-sm text-slate-600">{r.guardian_name || '-'}</td>
            <td className="px-4 py-3 text-right">
              {isAdmin && (
                <div className="flex items-center justify-end gap-1">
                  <button onClick={editRecord} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDelete(r.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              )}
            </td>
          </tr>
        );
      case 'beneficiaire':
        return (
          <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
            <td className="px-4 py-3 text-sm font-medium text-slate-900">{name}</td>
            <td className="px-4 py-3 text-sm text-slate-600">{r.program || '-'}</td>
            <td className="px-4 py-3 text-sm text-slate-600">{r.aid_type || '-'}</td>
            <td className="px-4 py-3 text-sm text-slate-600">{r.amount ? `${r.amount} Ar` : '-'}</td>
            <td className="px-4 py-3 text-sm">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.status === 'active' ? 'bg-emerald-50 text-emerald-700' : r.status === 'completed' ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'}`}>
                {r.status}
              </span>
            </td>
            <td className="px-4 py-3 text-right">
              {isAdmin && (
                <div className="flex items-center justify-end gap-1">
                  <button onClick={editRecord} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDelete(r.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              )}
            </td>
          </tr>
        );
      case 'salaire':
        return (
          <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
            <td className="px-4 py-3 text-sm font-medium text-slate-900">{name}</td>
            <td className="px-4 py-3 text-sm text-slate-600">{r.amount ? `${r.amount} Ar` : '-'}</td>
            <td className="px-4 py-3 text-sm text-slate-600">{r.month || '-'}</td>
            <td className="px-4 py-3 text-sm text-slate-600">{r.payment_date || '-'}</td>
            <td className="px-4 py-3 text-sm">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.status === 'paid' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                {r.status === 'paid' ? t('paid') : t('pending')}
              </span>
            </td>
            <td className="px-4 py-3 text-right">
              {isAdmin && (
                <div className="flex items-center justify-end gap-1">
                  <button onClick={editRecord} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDelete(r.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              )}
            </td>
          </tr>
        );
      case 'medicament':
        return (
          <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
            <td className="px-4 py-3 text-sm font-medium text-slate-900">{name}</td>
            <td className="px-4 py-3 text-sm text-slate-600">{r.medication_name || '-'}</td>
            <td className="px-4 py-3 text-sm text-slate-600">{r.dosage || '-'}</td>
            <td className="px-4 py-3 text-sm text-slate-600">{r.frequency || '-'}</td>
            <td className="px-4 py-3 text-sm text-slate-600">{r.prescribed_by || '-'}</td>
            <td className="px-4 py-3 text-right">
              {isAdmin && (
                <div className="flex items-center justify-end gap-1">
                  <button onClick={editRecord} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDelete(r.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              )}
            </td>
          </tr>
        );
      case 'cantine':
        return (
          <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
            <td className="px-4 py-3 text-sm font-medium text-slate-900">{name}</td>
            <td className="px-4 py-3 text-sm text-slate-600">{r.meal_count}</td>
            <td className="px-4 py-3 text-sm text-slate-600 capitalize">{r.meal_type}</td>
            <td className="px-4 py-3 text-sm text-slate-600">{r.nutrition_status || '-'}</td>
            <td className="px-4 py-3 text-sm text-slate-600">{r.tracking_date || '-'}</td>
            <td className="px-4 py-3 text-right">
              {isAdmin && (
                <div className="flex items-center justify-end gap-1">
                  <button onClick={editRecord} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDelete(r.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              )}
            </td>
          </tr>
        );
      case 'gargote':
        return (
          <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
            <td className="px-4 py-3 text-sm font-medium text-slate-900">{name}</td>
            <td className="px-4 py-3 text-sm text-slate-600">{r.activity || '-'}</td>
            <td className="px-4 py-3 text-sm text-slate-600">{r.participation_count}</td>
            <td className="px-4 py-3 text-sm text-slate-600">{r.tracking_date || '-'}</td>
            <td className="px-4 py-3 text-right">
              {isAdmin && (
                <div className="flex items-center justify-end gap-1">
                  <button onClick={editRecord} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDelete(r.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              )}
            </td>
          </tr>
        );
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">{t('suivi')}</h1>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button onClick={() => { resetForm(); setShowForm(true); }}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl transition-all shadow-sm">
              <Plus className="w-4 h-4" /> {t('add')}
            </button>
          )}
          <button onClick={loadRecords} className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 overflow-x-auto pb-2">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button key={tab.key} onClick={() => { setActiveTab(tab.key); resetForm(); }}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                isActive ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}>
              <Icon className="w-4 h-4" />
              {t(tab.labelKey)}
            </button>
          );
        })}
      </div>

      {error && <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>}

      {/* Add/Edit Form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={resetForm}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">{editingId ? t('edit') : t('add')}</h2>
              <button onClick={resetForm} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              {renderFormFields()}
            </div>
            <div className="flex items-center gap-3 mt-6">
              <button onClick={handleSave}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl transition-all">
                {t('save')}
              </button>
              <button onClick={resetForm}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition-all">
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder={`${t('search')}...`}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">{t('loading')}</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-400">{t('noData')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{t('name')}</th>
                  {activeTab === 'personnel' && <>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{t('position')}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{t('department')}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{t('contractType')}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{t('salary')}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{t('contractStart')}</th>
                  </>}
                  {activeTab === 'mere' && <>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{t('prenatal')}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{t('postnatal')}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{t('numberOfChildren')}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{t('healthStatus')}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{t('supportType')}</th>
                  </>}
                  {activeTab === 'enfant' && <>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{t('schoolLevel')}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{t('healthStatus')}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{t('nutrition')}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{t('guardian')}</th>
                  </>}
                  {activeTab === 'beneficiaire' && <>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{t('program')}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{t('aidType')}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{t('amount')}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{t('status')}</th>
                  </>}
                  {activeTab === 'salaire' && <>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{t('amount')}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{t('month')}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{t('date')}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{t('status')}</th>
                  </>}
                  {activeTab === 'medicament' && <>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{t('medication')}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{t('dosage')}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{t('frequency')}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{t('prescribedBy')}</th>
                  </>}
                  {activeTab === 'cantine' && <>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{t('mealCount')}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{t('mealType')}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{t('nutrition')}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{t('date')}</th>
                  </>}
                  {activeTab === 'gargote' && <>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{t('activity')}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{t('participationCount')}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{t('date')}</th>
                  </>}
                  {isAdmin && <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">{t('actions')}</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => renderRecordRow(r))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}


