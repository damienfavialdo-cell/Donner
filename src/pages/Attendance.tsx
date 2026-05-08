import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import type { AttendanceRecord, Event, Person } from '@/lib/types';
import {
  ClipboardList,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Trash2,
  Filter,
  Calendar,
} from 'lucide-react';

interface AttendanceRow extends AttendanceRecord {
  person?: { first_name: string; last_name: string; barcode_id: string } | null;
  member?: { first_name: string; last_name: string; barcode_id: string } | null;
  event?: { name: string } | null;
}

export default function Attendance() {
  const { tenant, tenantRole } = useAuth();
  const [records, setRecords] = useState<AttendanceRow[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [persons, setPersons] = useState<Record<string, Person>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterEvent, setFilterEvent] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const canDelete = tenantRole ? ['owner', 'admin'].includes(tenantRole) : false;

  const loadData = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    const tid = tenant.id;

    try {
      let query = supabase
        .from('attendance')
        .select(
          'id, tenant_id, member_id, person_id, event_id, direction, scanned_at, scanned_by, notes, ' +
            'member:members(first_name, last_name, barcode_id), ' +
            'event:events(name)'
        )
        .eq('tenant_id', tid)
        .order('scanned_at', { ascending: false })
        .limit(500);

      if (filterEvent) {
        query = query.eq('event_id', filterEvent);
      }
      if (filterFrom) {
        query = query.gte('scanned_at', filterFrom + 'T00:00:00');
      }
      if (filterTo) {
        query = query.lte('scanned_at', filterTo + 'T23:59:59');
      }

      const [attRes, evRes] = await Promise.all([
        query,
        supabase
          .from('events')
          .select('*')
          .eq('tenant_id', tid)
          .order('event_date', { ascending: false }),
      ]);

      if (attRes.error) throw attRes.error;
      if (evRes.error) throw evRes.error;

      const attendanceRows = (attRes.data || []) as unknown as AttendanceRow[];
      setRecords(attendanceRows);
      setEvents(evRes.data || []);

      // Collect person_ids that are not covered by the member join
      const personIds = attendanceRows
        .filter((r) => r.person_id && !r.member)
        .map((r) => r.person_id!);

      const uniquePersonIds = [...new Set(personIds)];
      const personMap: Record<string, Person> = {};

      if (uniquePersonIds.length > 0) {
        const { data: personData, error: personErr } = await supabase
          .from('persons')
          .select('id, first_name, last_name, barcode_id')
          .in('id', uniquePersonIds);

        if (!personErr && personData) {
          for (const p of personData) {
            personMap[p.id] = p as Person;
          }
        }
      }

      setPersons(personMap);
    } catch (err) {
      console.error('Failed to load attendance data:', err);
    }
    setLoading(false);
  }, [tenant, filterEvent, filterFrom, filterTo]);

  useEffect(() => {
    if (!tenant) return;
    loadData();
  }, [tenant, loadData]);

  async function handleDelete(id: string) {
    if (!tenant) return;
    if (!confirm('Are you sure you want to delete this attendance record? This action cannot be undone.')) return;
    try {
      const { error } = await supabase
        .from('attendance')
        .delete()
        .eq('id', id)
        .eq('tenant_id', tenant.id);
      if (error) throw error;
      await loadData();
    } catch (err) {
      console.error('Failed to delete attendance record:', err);
    }
  }

  function getPersonName(record: AttendanceRow): string {
    if (record.member) {
      return `${record.member.first_name} ${record.member.last_name}`;
    }
    if (record.person_id && persons[record.person_id]) {
      const p = persons[record.person_id];
      return `${p.first_name} ${p.last_name}`;
    }
    return 'Unknown';
  }

  function getBarcode(record: AttendanceRow): string {
    if (record.member) {
      return record.member.barcode_id;
    }
    if (record.person_id && persons[record.person_id]) {
      return persons[record.person_id].barcode_id;
    }
    return '—';
  }

  const filtered = records.filter((r) => {
    const name = getPersonName(r).toLowerCase();
    const barcode = getBarcode(r).toLowerCase();
    const term = search.toLowerCase();
    return name.includes(term) || barcode.includes(term);
  });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Attendance Log</h1>
        <p className="text-slate-500 mt-1">{records.length} records</p>
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
                placeholder="Search by name or barcode..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            {/* Event filter */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <select
                value={filterEvent}
                onChange={(e) => setFilterEvent(e.target.value)}
                className="pl-10 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 appearance-none"
              >
                <option value="">All Events</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Date range filter */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <Calendar className="w-4 h-4 text-slate-400 hidden sm:block" />
            <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center flex-1">
              <label className="text-sm text-slate-500 whitespace-nowrap">From</label>
              <input
                type="date"
                value={filterFrom}
                onChange={(e) => setFilterFrom(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
              <label className="text-sm text-slate-500 whitespace-nowrap">To</label>
              <input
                type="date"
                value={filterTo}
                onChange={(e) => setFilterTo(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
              {(filterFrom || filterTo) && (
                <button
                  onClick={() => {
                    setFilterFrom('');
                    setFilterTo('');
                  }}
                  className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                >
                  Clear dates
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center">
            <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No attendance records found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                    Name
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                    Barcode
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                    Event
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                    Direction
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                    Time
                  </th>
                  {canDelete && (
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase w-10"></th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">
                      {getPersonName(r)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500 font-mono">
                      {getBarcode(r)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {r.event?.name || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          r.direction === 'entry'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {r.direction === 'entry' ? (
                          <ArrowUpRight className="w-3 h-3" />
                        ) : (
                          <ArrowDownRight className="w-3 h-3" />
                        )}
                        {r.direction === 'entry' ? 'Entry' : 'Exit'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {new Date(r.scanned_at).toLocaleString()}
                    </td>
                    {canDelete && (
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleDelete(r.id)}
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


