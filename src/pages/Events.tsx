import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import type { Event } from '@/lib/types';
import {
  Calendar,
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  Save,
  MapPin,
  Clock,
  Users,
} from 'lucide-react';

interface EventWithCount extends Event {
  participant_count: number;
}

const statusColors: Record<string, string> = {
  scheduled: 'bg-blue-50 text-blue-700',
  active: 'bg-emerald-50 text-emerald-700',
  completed: 'bg-slate-100 text-slate-600',
  cancelled: 'bg-red-50 text-red-700',
};

const statusLabels: Record<string, string> = {
  scheduled: 'Scheduled',
  active: 'Active',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export default function Events() {
  const { tenant, tenantRole } = useAuth();
  const [events, setEvents] = useState<EventWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Event | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    location: '',
    event_date: '',
    start_time: '',
    end_time: '',
  });
  const [error, setError] = useState<string | null>(null);

  const canEdit = tenantRole ? ['owner', 'admin'].includes(tenantRole) : false;

  const loadEvents = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    try {
      const [evRes, countRes] = await Promise.all([
        supabase
          .from('events')
          .select('*')
          .eq('tenant_id', tenant.id)
          .order('event_date', { ascending: false }),
        supabase
          .from('event_participants')
          .select('event_id')
          .eq('tenant_id', tenant.id),
      ]);

      if (evRes.error) throw evRes.error;
      if (countRes.error) throw countRes.error;

      // Count participants per event
      const countMap: Record<string, number> = {};
      for (const row of countRes.data || []) {
        countMap[row.event_id] = (countMap[row.event_id] || 0) + 1;
      }

      const eventsWithCount: EventWithCount[] = (evRes.data || []).map((ev) => ({
        ...ev,
        participant_count: countMap[ev.id] || 0,
      }));

      setEvents(eventsWithCount);
    } catch (err) {
      console.error('Failed to load events:', err);
    }
    setLoading(false);
  }, [tenant]);

  useEffect(() => {
    if (!tenant) return;
    loadEvents();
  }, [tenant, loadEvents]);

  function openCreate() {
    setEditing(null);
    setForm({
      name: '',
      description: '',
      location: '',
      event_date: new Date().toISOString().slice(0, 10),
      start_time: '',
      end_time: '',
    });
    setShowForm(true);
    setError(null);
  }

  function openEdit(ev: Event) {
    setEditing(ev);
    setForm({
      name: ev.name,
      description: ev.description || '',
      location: ev.location || '',
      event_date: ev.event_date,
      start_time: ev.start_time || '',
      end_time: ev.end_time || '',
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
        name: form.name,
        description: form.description || null,
        location: form.location || null,
        event_date: form.event_date,
        start_time: form.start_time || null,
        end_time: form.end_time || null,
      };

      if (editing) {
        const { error: err } = await supabase
          .from('events')
          .update(payload)
          .eq('id', editing.id)
          .eq('tenant_id', tenant.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase
          .from('events')
          .insert({ ...payload, tenant_id: tenant.id });
        if (err) throw err;
      }

      setShowForm(false);
      await loadEvents();
    } catch (err: any) {
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!tenant) return;
    if (!confirm('Are you sure you want to delete this event? This action cannot be undone.'))
      return;
    try {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', id)
        .eq('tenant_id', tenant.id);
      if (error) throw error;
      await loadEvents();
    } catch (err) {
      console.error('Failed to delete event:', err);
    }
  }

  async function toggleStatus(ev: Event) {
    if (!tenant) return;
    try {
      let newStatus: string;
      if (ev.status === 'scheduled') {
        newStatus = 'active';
      } else if (ev.status === 'active') {
        newStatus = 'completed';
      } else {
        newStatus = 'scheduled';
      }
      const { error } = await supabase
        .from('events')
        .update({ status: newStatus })
        .eq('id', ev.id)
        .eq('tenant_id', tenant.id);
      if (error) throw error;
      await loadEvents();
    } catch (err) {
      console.error('Failed to toggle event status:', err);
    }
  }

  const filtered = events.filter((ev) =>
    ev.name.toLowerCase().includes(search.toLowerCase())
  );

  function getToggleLabel(status: string): string {
    if (status === 'scheduled') return 'Activate';
    if (status === 'active') return 'Complete';
    return 'Reactivate';
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Events</h1>
          <p className="text-slate-500 mt-1">{events.length} total events</p>
        </div>
        {canEdit && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" /> Add Event
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
              placeholder="Search events..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center">
            <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No events found</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((ev) => {
              const dateObj = new Date(ev.event_date + 'T00:00:00');
              const month = dateObj.toLocaleString('en', { month: 'short' });
              const day = dateObj.getDate();

              return (
                <div
                  key={ev.id}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50 transition-colors"
                >
                  {/* Date badge */}
                  <div className="w-12 h-12 rounded-xl bg-blue-50 flex flex-col items-center justify-center text-blue-700 shrink-0">
                    <span className="text-xs font-medium leading-none">{month}</span>
                    <span className="text-lg font-bold leading-tight">{day}</span>
                  </div>

                  {/* Event info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 truncate">{ev.name}</p>
                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                      {ev.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {ev.location}
                        </span>
                      )}
                      {ev.start_time && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {ev.start_time}
                          {ev.end_time ? ` - ${ev.end_time}` : ''}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {ev.participant_count}
                      </span>
                    </div>
                  </div>

                  {/* Status badge */}
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${
                      statusColors[ev.status] || 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {statusLabels[ev.status] || ev.status}
                  </span>

                  {/* Actions */}
                  {canEdit && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => toggleStatus(ev)}
                        className="px-2 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                      >
                        {getToggleLabel(ev.status)}
                      </button>
                      <button
                        onClick={() => openEdit(ev)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(ev.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
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
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowForm(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">
                {editing ? 'Edit Event' : 'Add Event'}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Event Name
                </label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Location
                </label>
                <input
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={form.event_date}
                  onChange={(e) => setForm({ ...form, event_date: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={form.start_time}
                    onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={form.end_time}
                    onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={saving}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Event'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


