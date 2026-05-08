import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import type { Person, PersonCategory } from '@/lib/types';
import { Users, Plus, Search, Pencil, Trash2, X, Save, Filter, UserCheck, Camera, Upload } from 'lucide-react';

const CATEGORY_PREFIXES: Record<PersonCategory, string> = {
  beneficiary: 'BEN',
  child: 'CHD',
  mother: 'MTH',
  visitor: 'VST',
  staff: 'STF',
};

const CATEGORY_COLORS: Record<PersonCategory, { bg: string; text: string; avatar: string }> = {
  beneficiary: { bg: 'bg-emerald-50', text: 'text-emerald-700', avatar: 'bg-emerald-100 text-emerald-700' },
  child: { bg: 'bg-blue-50', text: 'text-blue-700', avatar: 'bg-blue-100 text-blue-700' },
  mother: { bg: 'bg-pink-50', text: 'text-pink-700', avatar: 'bg-pink-100 text-pink-700' },
  visitor: { bg: 'bg-amber-50', text: 'text-amber-700', avatar: 'bg-amber-100 text-amber-700' },
  staff: { bg: 'bg-teal-50', text: 'text-teal-700', avatar: 'bg-teal-100 text-teal-700' },
};

const CATEGORY_LABELS: Record<PersonCategory, string> = {
  beneficiary: 'Beneficiary',
  child: 'Child',
  mother: 'Mother',
  visitor: 'Visitor',
  staff: 'Staff',
};

type TabFilter = 'all' | PersonCategory;

const TABS: { key: TabFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'beneficiary', label: 'Beneficiaries' },
  { key: 'child', label: 'Children' },
  { key: 'mother', label: 'Mothers' },
  { key: 'visitor', label: 'Visitors' },
  { key: 'staff', label: 'Staff' },
];

const GENDER_OPTIONS = [
  { value: '', label: 'Prefer not to say' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];

interface FormData {
  first_name: string;
  last_name: string;
  category: PersonCategory;
  email: string;
  phone: string;
  barcode_id: string;
  date_of_birth: string;
  gender: string;
  address: string;
  notes: string;
}

const EMPTY_FORM: FormData = {
  first_name: '',
  last_name: '',
  category: 'beneficiary',
  email: '',
  phone: '',
  barcode_id: '',
  date_of_birth: '',
  gender: '',
  address: '',
  notes: '',
};

function generateBarcodeId(category: PersonCategory): string {
  const prefix = CATEGORY_PREFIXES[category];
  const random = Math.floor(100000 + Math.random() * 900000);
  return `ONG-${prefix}-${random}`;
}

function getPublicUrl(path: string): string {
  const url = import.meta.env.VITE_SUPABASE_URL;
  return `${url}/storage/v1/object/public/person-photos/${path}`;
}

export default function Persons() {
  const { tenant, tenantRole } = useAuth();
  const [persons, setPersons] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<TabFilter>('all');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Person | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  // Photo state
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canEdit = tenantRole ? ['owner', 'admin'].includes(tenantRole) : false;

  useEffect(() => {
    if (!tenant) return;
    loadPersons();
  }, [tenant]);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(t => t.stop());
      }
    };
  }, [cameraStream]);

  async function loadPersons() {
    if (!tenant) return;
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('persons')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('last_name');
      if (err) throw err;
      setPersons(data || []);
    } catch {
      // silently fail
    }
    setLoading(false);
  }

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setPhotoPreview(null);
    setPhotoFile(null);
    setShowForm(true);
    setError(null);
  }

  function openEdit(p: Person) {
    setEditing(p);
    setForm({
      first_name: p.first_name,
      last_name: p.last_name,
      category: p.category,
      email: p.email || '',
      phone: p.phone || '',
      barcode_id: p.barcode_id,
      date_of_birth: p.date_of_birth || '',
      gender: p.gender || '',
      address: p.address || '',
      notes: p.notes || '',
    });
    setPhotoPreview(p.photo_url || null);
    setPhotoFile(null);
    setShowForm(true);
    setError(null);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError('Photo must be under 2MB');
      return;
    }
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 320, height: 320 }
      });
      setCameraStream(stream);
      setShowCamera(true);
      setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      }, 100);
    } catch {
      setError('Camera access denied');
    }
  }

  function capturePhoto() {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = 320;
    canvas.height = 320;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, 320, 320);
    canvas.toBlob(blob => {
      if (!blob) return;
      const file = new File([blob], 'capture.jpg', { type: 'image/jpeg' });
      setPhotoFile(file);
      setPhotoPreview(canvas.toDataURL('image/jpeg', 0.85));
      stopCamera();
    }, 'image/jpeg', 0.85);
  }

  function stopCamera() {
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop());
      setCameraStream(null);
    }
    setShowCamera(false);
  }

  function removePhoto() {
    setPhotoPreview(null);
    setPhotoFile(null);
  }

  async function uploadPhoto(personId: string, file: File): Promise<string> {
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${tenant?.id}/${personId}.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from('person-photos')
      .upload(path, file, { upsert: true, contentType: file.type });
    if (uploadErr) throw uploadErr;
    return getPublicUrl(path);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!tenant) return;
    setSaving(true);
    setError(null);

    try {
      const barcodeId = form.barcode_id.trim() || generateBarcodeId(form.category);

      const payload: Record<string, any> = {
        first_name: form.first_name,
        last_name: form.last_name,
        category: form.category,
        email: form.email || null,
        phone: form.phone || null,
        barcode_id: barcodeId,
        date_of_birth: form.date_of_birth || null,
        gender: form.gender || null,
        address: form.address || null,
        notes: form.notes,
        active: true,
      };

      let personId: string;

      if (editing) {
        personId = editing.id;
        // Upload photo if changed
        if (photoFile) {
          const url = await uploadPhoto(personId, photoFile);
          payload.photo_url = url;
        } else if (!photoPreview && editing.photo_url) {
          // Photo was removed
          payload.photo_url = '';
        }
        const { error: err } = await supabase
          .from('persons')
          .update(payload)
          .eq('id', personId)
          .eq('tenant_id', tenant.id);
        if (err) throw err;
      } else {
        // Insert first to get ID, then upload photo
        const { data, error: err } = await supabase
          .from('persons')
          .insert({ ...payload, tenant_id: tenant.id })
          .select('id')
          .single();
        if (err) throw err;
        personId = data.id;

        // Upload photo after getting person ID
        if (photoFile) {
          const url = await uploadPhoto(personId, photoFile);
          await supabase
            .from('persons')
            .update({ photo_url: url })
            .eq('id', personId);
        }
      }

      setShowForm(false);
      await loadPersons();
    } catch (err: any) {
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!tenant) return;
    if (!confirm('Are you sure you want to permanently delete this person?')) return;
    try {
      const { error: err } = await supabase
        .from('persons')
        .delete()
        .eq('id', id)
        .eq('tenant_id', tenant.id);
      if (err) throw err;
      await loadPersons();
    } catch (err: any) {
      setError(err.message || 'Delete failed');
    }
  }

  const filtered = persons.filter(p => {
    if (activeTab !== 'all' && p.category !== activeTab) return false;
    const query = search.toLowerCase();
    if (!query) return true;
    return (
      `${p.first_name} ${p.last_name}`.toLowerCase().includes(query) ||
      (p.barcode_id || '').toLowerCase().includes(query) ||
      (p.email || '').toLowerCase().includes(query)
    );
  });

  const getInitials = (p: Person) => `${p.first_name?.[0] || '?'}${p.last_name?.[0] || '?'}`;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Persons</h1>
          <p className="text-slate-500 mt-1">{persons.length} total persons</p>
        </div>
        {canEdit && (
          <button onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl transition-all shadow-sm">
            <Plus className="w-4 h-4" /> Add Person
          </button>
        )}
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-1 mb-4 bg-white rounded-2xl border border-slate-200 shadow-sm p-1.5 overflow-x-auto">
        <Filter className="w-4 h-4 text-slate-400 ml-2 shrink-0" />
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-1.5 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.key ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search + Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="p-4 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, barcode, or email..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center">
            <UserCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No persons found</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map(p => {
              const colors = CATEGORY_COLORS[p.category];
              return (
                <div key={p.id} className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50 transition-colors">
                  {/* Photo or Avatar */}
                  {p.photo_url ? (
                    <img src={p.photo_url} alt={`${p.first_name} ${p.last_name}`}
                      className="w-10 h-10 rounded-full object-cover shrink-0 border-2 border-white shadow-sm" />
                  ) : (
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm shrink-0 ${colors.avatar}`}>
                      {getInitials(p)}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 truncate">{p.first_name} {p.last_name}</p>
                    <p className="text-xs text-slate-500 truncate">{p.barcode_id} {p.phone && `| ${p.phone}`}</p>
                  </div>

                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text} shrink-0`}>
                    {CATEGORY_LABELS[p.category]}
                  </span>

                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${p.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {p.active ? 'Active' : 'Inactive'}
                  </span>

                  {canEdit && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => openEdit(p)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(p.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => { setShowForm(false); stopCamera(); }}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">{editing ? 'Edit Person' : 'Add Person'}</h2>
              <button onClick={() => { setShowForm(false); stopCamera(); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3">
              {/* Photo Section */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Photo</label>
                <div className="flex items-center gap-4">
                  {photoPreview ? (
                    <div className="relative">
                      <img src={photoPreview} alt="Preview" className="w-20 h-20 rounded-xl object-cover border-2 border-slate-200" />
                      <button type="button" onClick={removePhoto}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-20 h-20 rounded-xl bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center">
                      <Users className="w-8 h-8 text-slate-300" />
                    </div>
                  )}
                  <div className="flex flex-col gap-2">
                    <button type="button" onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-all">
                      <Upload className="w-3.5 h-3.5" /> Upload
                    </button>
                    <button type="button" onClick={startCamera}
                      className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-all">
                      <Camera className="w-3.5 h-3.5" /> Capture
                    </button>
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
                </div>
              </div>

              {/* Camera Modal */}
              {showCamera && (
                <div className="bg-slate-900 rounded-xl p-3 space-y-2">
                  <video ref={videoRef} autoPlay playsInline className="w-full rounded-lg" style={{ maxHeight: '240px' }} />
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={capturePhoto}
                      className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-all">
                      <Camera className="w-4 h-4 inline mr-1" /> Capture
                    </button>
                    <button type="button" onClick={stopCamera}
                      className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-all">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              <canvas ref={canvasRef} className="hidden" />

              {/* Name */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">First Name</label>
                  <input required value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Last Name</label>
                  <input required value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value as PersonCategory })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent">
                  {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
              </div>

              {/* Phone & DOB */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                  <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Date of Birth</label>
                  <input type="date" value={form.date_of_birth} onChange={e => setForm({ ...form, date_of_birth: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
                </div>
              </div>

              {/* Barcode */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Barcode ID <span className="text-slate-400 font-normal">(leave empty to auto-generate)</span>
                </label>
                <input value={form.barcode_id} onChange={e => setForm({ ...form, barcode_id: e.target.value })}
                  placeholder={`e.g. ${generateBarcodeId(form.category)}`}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
              </div>

              {/* Gender */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Gender</label>
                <select value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent">
                  {GENDER_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Address */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button type="submit" disabled={saving}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2">
                <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Person'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


