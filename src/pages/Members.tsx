import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import type { Member } from '@/lib/types';
import { Users, Plus, Search, Pencil as Edit2, Trash2, X, Save } from 'lucide-react';

export default function Members() {
  const { tenant, tenantRole } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ first_name: '', last_name: '', barcode_id: '', email: '', phone: '', notes: '' });
  const [error, setError] = useState<string | null>(null);

  const canEdit = tenantRole && ['owner', 'admin'].includes(tenantRole);

  useEffect(() => {
    if (!tenant) return;
    loadMembers();
  }, [tenant]);

  async function loadMembers() {
    if (!tenant) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('members')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('last_name');
      setMembers(data || []);
    } catch {
      // silently fail - members will show as empty
    }
    setLoading(false);
  }

  function openCreate() {
    setEditing(null);
    setForm({ first_name: '', last_name: '', barcode_id: '', email: '', phone: '', notes: '' });
    setShowForm(true);
    setError(null);
  }

  function openEdit(m: Member) {
    setEditing(m);
    setForm({ first_name: m.first_name, last_name: m.last_name, barcode_id: m.barcode_id, email: m.email || '', phone: m.phone || '', notes: m.notes || '' });
    setShowForm(true);
    setError(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!tenant) return;
    setSaving(true);
    setError(null);

    try {
      if (editing) {
        const { error: err } = await supabase
          .from('members')
          .update({ first_name: form.first_name, last_name: form.last_name, barcode_id: form.barcode_id, email: form.email || null, phone: form.phone || null, notes: form.notes })
          .eq('id', editing.id)
          .eq('tenant_id', tenant.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase
          .from('members')
          .insert({ tenant_id: tenant.id, first_name: form.first_name, last_name: form.last_name, barcode_id: form.barcode_id, email: form.email || null, phone: form.phone || null, notes: form.notes });
        if (err) throw err;
      }
      setShowForm(false);
      await loadMembers();
    } catch (err: any) {
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!tenant || !confirm('Deactivate this member?')) return;
    await supabase.from('members').update({ active: false }).eq('id', id).eq('tenant_id', tenant.id);
    await loadMembers();
  }

  const filtered = members.filter(m =>
    `${m.first_name} ${m.last_name} ${m.barcode_id}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Members</h1>
          <p className="text-slate-500 mt-1">{members.length} total members</p>
        </div>
        {canEdit && (
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl transition-all shadow-sm">
            <Plus className="w-4 h-4" /> Add Member
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="p-4 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search members..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No members found</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map(m => (
              <div key={m.id} className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50 transition-colors">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-semibold text-sm">
                  {(m.first_name?.[0] || '?')}{(m.last_name?.[0] || '?')}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 truncate">{m.first_name} {m.last_name}</p>
                  <p className="text-xs text-slate-500">{m.barcode_id} {m.email && `| ${m.email}`}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${m.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {m.active ? 'Active' : 'Inactive'}
                </span>
                {canEdit && (
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEdit(m)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(m.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">{editing ? 'Edit Member' : 'Add Member'}</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleSave} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">First Name</label>
                  <input required value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Last Name</label>
                  <input required value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Barcode ID</label>
                <input required value={form.barcode_id} onChange={e => setForm({ ...form, barcode_id: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button type="submit" disabled={saving} className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2">
                <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Member'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


