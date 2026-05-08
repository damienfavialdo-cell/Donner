import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { useI18n } from '@/i18n';
import type { Person, Event, AttendanceRecord } from '@/lib/types';
import { ClipboardCheck, Plus, Search, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface RecentEntry extends AttendanceRecord {
  persons?: { first_name: string; last_name: string; barcode_id: string } | null;
  events?: { name: string } | null;
}

export default function ManualAttendance() {
  const { user, tenant, tenantRole } = useAuth();
  const { t } = useI18n();

  const [persons, setPersons] = useState<Person[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [recentEntries, setRecentEntries] = useState<RecentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [selectedPersonId, setSelectedPersonId] = useState('');
  const [selectedEventId, setSelectedEventId] = useState('');
  const [direction, setDirection] = useState<'entry' | 'exit'>('entry');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Searchable dropdown state
  const [personSearch, setPersonSearch] = useState('');
  const [personDropdownOpen, setPersonDropdownOpen] = useState(false);
  const personDropdownRef = useRef<HTMLDivElement>(null);

  // Filter for recent entries
  const [entrySearch, setEntrySearch] = useState('');

  const isAdmin = tenantRole ? ['owner', 'admin'].includes(tenantRole) : false;

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (personDropdownRef.current && !personDropdownRef.current.contains(e.target as Node)) {
        setPersonDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Load persons, events, and recent entries
  useEffect(() => {
    if (!tenant) {
      setLoading(false);
      return;
    }
    const tid = tenant.id;
    let mounted = true;

    (async () => {
      setLoading(true);
      try {
        const [personsRes, eventsRes, entriesRes] = await Promise.all([
          supabase
            .from('persons')
            .select('*')
            .eq('tenant_id', tid)
            .eq('active', true)
            .order('last_name'),
          supabase
            .from('events')
            .select('*')
            .eq('tenant_id', tid)
            .in('status', ['scheduled', 'active'])
            .order('event_date', { ascending: false }),
          supabase
            .from('attendance')
            .select('*, persons(first_name, last_name, barcode_id), events(name)')
            .eq('tenant_id', tid)
            .order('scanned_at', { ascending: false })
            .limit(50),
        ]);

        if (!mounted) return;

        if (personsRes.error) throw personsRes.error;
        if (eventsRes.error) throw eventsRes.error;
        if (entriesRes.error) throw entriesRes.error;

        setPersons(personsRes.data || []);
        setEvents(eventsRes.data || []);
        setRecentEntries((entriesRes.data || []) as RecentEntry[]);
      } catch {
        // silently handle - data will show as empty
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, [tenant]);

  // Auto-detect direction when a person is selected
  useEffect(() => {
    if (!selectedPersonId || !tenant) return;

    (async () => {
      try {
        const { data, error: err } = await supabase
          .from('attendance')
          .select('direction')
          .eq('tenant_id', tenant.id)
          .eq('person_id', selectedPersonId)
          .order('scanned_at', { ascending: false })
          .limit(1);

        if (err) return;
        if (data && data.length > 0) {
          setDirection(data[0].direction === 'entry' ? 'exit' : 'entry');
        } else {
          setDirection('entry');
        }
      } catch {
        // keep current direction on error
      }
    })();
  }, [selectedPersonId, tenant]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tenant || !user || !selectedPersonId) return;

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const scannedAt = new Date(`${date}T${time}:00`).toISOString();

      const { data, error: err } = await supabase
        .from('attendance')
        .insert({
          tenant_id: tenant.id,
          person_id: selectedPersonId,
          event_id: selectedEventId || null,
          direction,
          scanned_at: scannedAt,
          scanned_by: user.id,
          notes: notes.trim() || '',
        })
        .select('*, persons(first_name, last_name, barcode_id), events(name)')
        .single();

      if (err) throw err;

      if (data) {
        setRecentEntries(prev => [data as RecentEntry, ...prev]);
      }

      const selectedPerson = persons.find(p => p.id === selectedPersonId);
      setSuccess(
        `${direction === 'entry' ? t('entry') : t('exit')} - ${selectedPerson?.first_name || ''} ${selectedPerson?.last_name || ''}`
      );

      // Reset form
      setSelectedPersonId('');
      setPersonSearch('');
      setSelectedEventId('');
      setNotes('');
      setDirection('entry');
      setTime(() => {
        const now = new Date();
        return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      });

      // Clear success after 3s
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || t('submit_failed'));
    } finally {
      setSubmitting(false);
    }
  }

  const filteredPersons = persons.filter(p => {
    const q = personSearch.toLowerCase();
    if (!q) return true;
    return (
      `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) ||
      (p.barcode_id || '').toLowerCase().includes(q)
    );
  });

  const filteredEntries = recentEntries.filter(e => {
    const q = entrySearch.toLowerCase();
    if (!q) return true;
    const personName = e.persons
      ? `${e.persons.first_name} ${e.persons.last_name}`
      : '';
    return (
      personName.toLowerCase().includes(q) ||
      (e.persons?.barcode_id || '').toLowerCase().includes(q) ||
      (e.events?.name || '').toLowerCase().includes(q) ||
      e.direction.includes(q)
    );
  });

  const selectedPerson = persons.find(p => p.id === selectedPersonId);

  if (!isAdmin) {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">{t('manual_attendance')}</h1>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
          <ClipboardCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">{t('admin_only')}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">{t('manual_attendance')}</h1>
        <p className="text-slate-500 mt-1">{t('manual_attendance_desc')}</p>
      </div>

      {/* Form Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-8">
        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-50 mx-auto mb-4">
          <ClipboardCheck className="w-8 h-8 text-emerald-600" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 max-w-lg mx-auto">
          {/* Person Searchable Dropdown */}
          <div ref={personDropdownRef}>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              {t('person')} <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={selectedPersonId ? (selectedPerson ? `${selectedPerson.first_name} ${selectedPerson.last_name}` : '') : personSearch}
                onChange={e => {
                  setPersonSearch(e.target.value);
                  setSelectedPersonId('');
                  setPersonDropdownOpen(true);
                }}
                onFocus={() => {
                  if (!selectedPersonId) setPersonDropdownOpen(true);
                }}
                placeholder={t('search_person_placeholder')}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
              {selectedPersonId && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPersonId('');
                    setPersonSearch('');
                    setPersonDropdownOpen(true);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <Plus className="w-4 h-4 rotate-45" />
                </button>
              )}
              {personDropdownOpen && !selectedPersonId && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                  {filteredPersons.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-slate-400">{t('no_persons_found')}</div>
                  ) : (
                    filteredPersons.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSelectedPersonId(p.id);
                          setPersonSearch('');
                          setPersonDropdownOpen(false);
                        }}
                        className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors flex items-center gap-3 text-sm"
                      >
                        <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-semibold text-xs shrink-0">
                          {p.first_name?.[0]}{p.last_name?.[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 truncate">{p.first_name} {p.last_name}</p>
                          <p className="text-xs text-slate-500 truncate">{p.barcode_id}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Event Selector */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('event')} <span className="text-slate-400 font-normal">({t('optional')})</span></label>
            <select
              value={selectedEventId}
              onChange={e => setSelectedEventId(e.target.value)}
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            >
              <option value="">{t('no_event')}</option>
              {events.map(ev => (
                <option key={ev.id} value={ev.id}>{ev.name} — {ev.event_date}</option>
              ))}
            </select>
          </div>

          {/* Direction Toggle */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('direction')}</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDirection('entry')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium text-sm transition-all border ${
                  direction === 'entry'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <ArrowUpRight className="w-4 h-4" />
                {t('entry')}
              </button>
              <button
                type="button"
                onClick={() => setDirection('exit')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium text-sm transition-all border ${
                  direction === 'exit'
                    ? 'bg-amber-50 border-amber-200 text-amber-700'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <ArrowDownRight className="w-4 h-4" />
                {t('exit')}
              </button>
            </div>
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('date')}</label>
              <input
                type="date"
                required
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('time')}</label>
              <input
                type="time"
                required
                value={time}
                onChange={e => setTime(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('notes')} <span className="text-slate-400 font-normal">({t('optional')})</span></label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder={t('manual_attendance_notes_placeholder')}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          {/* Error / Success */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              {error}
            </div>
          )}
          {success && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">
              {success}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting || !selectedPersonId}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {submitting ? t('submitting') : t('record_attendance')}
          </button>
        </form>
      </div>

      {/* Recent Entries Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{t('recent_manual_entries')}</h2>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={entrySearch}
              onChange={e => setEntrySearch(e.target.value)}
              placeholder={t('search_entries')}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400">{t('loading')}</div>
        ) : filteredEntries.length === 0 ? (
          <div className="p-8 text-center">
            <ClipboardCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">{t('no_manual_entries')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('person')}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('direction')}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('event')}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('scanned_at')}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('notes')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEntries.map(entry => (
                  <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      {entry.persons ? (
                        <div>
                          <p className="font-medium text-slate-900">{entry.persons.first_name} {entry.persons.last_name}</p>
                          <p className="text-xs text-slate-500">{entry.persons.barcode_id}</p>
                        </div>
                      ) : (
                        <span className="text-slate-400">{t('unknown')}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        entry.direction === 'entry'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}>
                        {entry.direction === 'entry' ? (
                          <ArrowUpRight className="w-3 h-3" />
                        ) : (
                          <ArrowDownRight className="w-3 h-3" />
                        )}
                        {entry.direction === 'entry' ? t('entry') : t('exit')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {entry.events?.name || <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {new Date(entry.scanned_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-slate-500 max-w-[200px] truncate">
                      {entry.notes || <span className="text-slate-400">—</span>}
                    </td>
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


