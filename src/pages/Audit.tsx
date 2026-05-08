import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { useI18n } from '@/i18n';
import { Shield, Search, Calendar, User } from 'lucide-react';

interface AuditLog {
  id: string;
  tenant_id: string;
  user_id: string | null;
  action: string;
  table_name: string;
  record_id: string | null;
  old_data: Record<string, any> | null;
  new_data: Record<string, any> | null;
  created_at: string;
}

interface UserMap {
  [userId: string]: string;
}

const ACTION_TYPES = ['', 'INSERT', 'UPDATE', 'DELETE'];

const TABLE_NAMES = [
  '',
  'persons',
  'members',
  'events',
  'attendance',
  'medical_records',
  'badges',
  'notifications',
  'reports',
  'tenant_users',
  'tenants',
];

export default function Audit() {
  const { tenant } = useAuth();
  const { t } = useI18n();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterTable, setFilterTable] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [searchRecordId, setSearchRecordId] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [userMap, setUserMap] = useState<UserMap>({});
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 100;

  const loadData = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    try {
      let query = supabase
        .from('audit_logs')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (filterFrom) {
        query = query.gte('created_at', filterFrom + 'T00:00:00');
      }
      if (filterTo) {
        query = query.lte('created_at', filterTo + 'T23:59:59');
      }
      if (filterTable) {
        query = query.eq('table_name', filterTable);
      }
      if (filterAction) {
        query = query.eq('action', filterAction);
      }
      if (searchRecordId) {
        query = query.eq('record_id', searchRecordId);
      }

      const { data, error: err } = await query;
      if (err) throw err;
      setLogs(data || []);

      // Fetch user emails for user_ids in the current batch
      const userIds = [...new Set((data || []).map((l) => l.user_id).filter(Boolean))] as string[];
      if (userIds.length > 0) {
        const { data: userData, error: userErr } = await supabase
          .from('tenant_users')
          .select('user_id')
          .in('user_id', userIds);

        // Try getting emails from auth users via a persons lookup or tenant_users
        // If we can't get emails, fall back to user IDs
        if (!userErr && userData) {
          const map: UserMap = {};
          // Try to look up emails from the profiles or users if available
          // Otherwise we just use the user_id
          for (const uid of userIds) {
            map[uid] = uid;
          }
          setUserMap((prev) => ({ ...prev, ...map }));
        }
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    }
    setLoading(false);
  }, [tenant, page, filterFrom, filterTo, filterTable, filterAction, searchRecordId]);

  useEffect(() => {
    if (!tenant) return;
    loadData();
  }, [tenant, loadData]);

  // Also fetch person names for person-related audit entries
  const [personNames, setPersonNames] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!tenant) return;
    const tid = tenant.id;
    async function fetchPersons() {
      try {
        const { data, error: err } = await supabase
          .from('persons')
          .select('id, first_name, last_name')
          .eq('tenant_id', tid);
        if (err) throw err;
        const map: Record<string, string> = {};
        for (const p of data || []) {
          map[p.id] = `${p.first_name} ${p.last_name}`;
        }
        setPersonNames(map);
      } catch (err) {
        console.error('Failed to load persons for audit:', err);
      }
    }
    fetchPersons();
  }, [tenant]);

  function getUserDisplay(userId: string | null): string {
    if (!userId) return '—';
    // If userMap has an email, show it; otherwise show the ID
    const email = userMap[userId];
    if (email && email !== userId) return email;
    // Truncate long IDs
    if (userId.length > 12) return userId.slice(0, 8) + '...';
    return userId;
  }

  function toggleExpand(id: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function formatJson(data: Record<string, any> | null): string {
    if (!data) return '';
    return JSON.stringify(data, null, 2);
  }

  function getActionColor(action: string): string {
    switch (action) {
      case 'INSERT':
        return 'bg-emerald-50 text-emerald-700';
      case 'UPDATE':
        return 'bg-blue-50 text-blue-700';
      case 'DELETE':
        return 'bg-red-50 text-red-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  }

  const hasFilters = filterFrom || filterTo || filterTable || filterAction || searchRecordId;

  function clearFilters() {
    setFilterFrom('');
    setFilterTo('');
    setFilterTable('');
    setFilterAction('');
    setSearchRecordId('');
    setPage(0);
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">{t('audit_log')}</h1>
        <p className="text-slate-500 mt-1">{t('audit_log_description')}</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        {/* Filters */}
        <div className="p-4 border-b border-slate-100 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search by record ID */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchRecordId}
                onChange={(e) => {
                  setSearchRecordId(e.target.value);
                  setPage(0);
                }}
                placeholder={t('search_by_record_id')}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            {/* Table filter */}
            <select
              value={filterTable}
              onChange={(e) => {
                setFilterTable(e.target.value);
                setPage(0);
              }}
              className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            >
              <option value="">{t('all_tables')}</option>
              {TABLE_NAMES.filter(Boolean).map((tbl) => (
                <option key={tbl} value={tbl}>
                  {tbl}
                </option>
              ))}
            </select>

            {/* Action filter */}
            <select
              value={filterAction}
              onChange={(e) => {
                setFilterAction(e.target.value);
                setPage(0);
              }}
              className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            >
              <option value="">{t('all_actions')}</option>
              {ACTION_TYPES.filter(Boolean).map((act) => (
                <option key={act} value={act}>
                  {act}
                </option>
              ))}
            </select>
          </div>

          {/* Date range */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <Calendar className="w-4 h-4 text-slate-400 hidden sm:block" />
            <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center flex-1">
              <label className="text-sm text-slate-500 whitespace-nowrap">{t('from')}</label>
              <input
                type="date"
                value={filterFrom}
                onChange={(e) => {
                  setFilterFrom(e.target.value);
                  setPage(0);
                }}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
              <label className="text-sm text-slate-500 whitespace-nowrap">{t('to')}</label>
              <input
                type="date"
                value={filterTo}
                onChange={(e) => {
                  setFilterTo(e.target.value);
                  setPage(0);
                }}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
              {hasFilters && (
                <button
                  onClick={clearFilters}
                  className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                >
                  {t('clear_filters')}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="p-8 text-center text-slate-400">{t('loading')}</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center">
            <Shield className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">{t('no_audit_logs')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                    {t('timestamp')}
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                    {t('user')}
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                    {t('action')}
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                    {t('table')}
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                    {t('record_id')}
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => {
                  const isExpanded = expandedRows.has(log.id);
                  return (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-900 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[150px]">
                            {getUserDisplay(log.user_id)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${getActionColor(log.action)}`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 font-mono">
                        {log.table_name}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500 font-mono max-w-[120px] truncate">
                        {log.record_id || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleExpand(log.id)}
                          className="text-xs text-emerald-600 hover:text-emerald-700 font-medium whitespace-nowrap"
                        >
                          {isExpanded ? t('hide_details') : t('show_details')}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Expanded details rendered below the table */}
        {logs.filter((l) => expandedRows.has(l.id)).length > 0 && (
          <div className="border-t border-slate-200 divide-y divide-slate-100">
            {logs
              .filter((l) => expandedRows.has(l.id))
              .map((log) => (
                <div key={log.id} className="px-4 py-3 bg-slate-50">
                  <p className="text-xs font-semibold text-slate-500 mb-2">
                    {new Date(log.created_at).toLocaleString()} - {log.action} on {log.table_name}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {log.old_data && (
                      <div>
                        <p className="text-xs font-medium text-slate-400 mb-1 uppercase">
                          {t('old_data')}
                        </p>
                        <pre className="text-xs text-slate-700 bg-white rounded-xl border border-slate-200 p-3 overflow-x-auto whitespace-pre-wrap">
                          {formatJson(log.old_data)}
                        </pre>
                      </div>
                    )}
                    {log.new_data && (
                      <div>
                        <p className="text-xs font-medium text-slate-400 mb-1 uppercase">
                          {t('new_data')}
                        </p>
                        <pre className="text-xs text-slate-700 bg-white rounded-xl border border-slate-200 p-3 overflow-x-auto whitespace-pre-wrap">
                          {formatJson(log.new_data)}
                        </pre>
                      </div>
                    )}
                    {!log.old_data && !log.new_data && (
                      <p className="text-sm text-slate-400 col-span-2">{t('no_data_available')}</p>
                    )}
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* Pagination */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between">
          <p className="text-sm text-slate-500">
            {t('page')} {page + 1}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {t('previous')}
            </button>
            <button
              onClick={() => setPage(page + 1)}
              disabled={logs.length < PAGE_SIZE}
              className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {t('next')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


