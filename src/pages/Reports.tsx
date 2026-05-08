import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import type { Report } from '@/lib/types';
import {
  FileBarChart,
  Download,
  FileSpreadsheet,
  FileText,
  Calendar,
  Plus,
  Trash2,
} from 'lucide-react';

type ReportType = 'daily' | 'weekly' | 'monthly' | 'custom';

export default function Reports() {
  const { tenant, user, tenantRole } = useAuth();
  const isAdmin = tenantRole === 'admin';

  const [reportType, setReportType] = useState<ReportType>('daily');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [format, setFormat] = useState<'pdf' | 'excel'>('pdf');
  const [eventId, setEventId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<{ id: string; name: string; event_date: string }[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);

  // Compute date range based on report type
  const computeDateRange = useCallback(
    (type: ReportType): { from: string; to: string } => {
      const today = new Date();
      const to = today.toISOString().slice(0, 10);

      if (type === 'daily') {
        return { from: to, to };
      }
      if (type === 'weekly') {
        const from = new Date(today);
        from.setDate(from.getDate() - 6);
        return { from: from.toISOString().slice(0, 10), to };
      }
      if (type === 'monthly') {
        const from = new Date(today.getFullYear(), today.getMonth(), 1);
        return { from: from.toISOString().slice(0, 10), to };
      }
      return { from: dateFrom, to: dateTo };
    },
    [dateFrom, dateTo],
  );

  // Load events for the filter
  useEffect(() => {
    if (!tenant) return;
    let cancelled = false;
    (async () => {
      try {
        const { data, error: err } = await supabase
          .from('events')
          .select('id, name, event_date')
          .eq('tenant_id', tenant.id)
          .order('event_date', { ascending: false });
        if (!cancelled && !err) setEvents(data || []);
      } catch {
        // silently fail
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenant]);

  // Load previously generated reports
  const loadReports = useCallback(async () => {
    if (!tenant) return;
    setReportsLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('reports')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });
      if (!err) setReports(data || []);
    } catch {
      // keep empty
    }
    setReportsLoading(false);
  }, [tenant]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  // Build attendance HTML for PDF reports
  async function buildAttendanceHTML(range: { from: string; to: string }, evId: string) {
    if (!tenant) return '';

    let query = supabase
      .from('attendance')
      .select('id, direction, scanned_at, person_id, persons:first_name, persons:last_name')
      .eq('tenant_id', tenant.id)
      .order('scanned_at', { ascending: false });

    if (range.from) query = query.gte('scanned_at', range.from);
    if (range.to) query = query.lte('scanned_at', range.to + 'T23:59:59');
    if (evId) query = query.eq('event_id', evId);

    const { data: attendance } = await query;

    // Fetch person names separately for reliability
    const personIds = [...new Set((attendance || []).map((a: any) => a.person_id).filter(Boolean))];
    const personMap: Record<string, { first_name: string; last_name: string }> = {};

    if (personIds.length > 0) {
      const { data: persons } = await supabase
        .from('persons')
        .select('id, first_name, last_name')
        .in('id', personIds);
      (persons || []).forEach((p: any) => {
        personMap[p.id] = { first_name: p.first_name, last_name: p.last_name };
      });
    }

    const rows = (attendance || [])
      .map((a: any, i: number) => {
        const person = personMap[a.person_id];
        const name = person ? `${person.first_name} ${person.last_name}` : 'Unknown';
        const direction = a.direction === 'entry' ? 'Entry' : 'Exit';
        const time = new Date(a.scanned_at).toLocaleString();
        return `<tr><td>${i + 1}</td><td>${name}</td><td>${direction}</td><td>${time}</td></tr>`;
      })
      .join('\n');

    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Attendance Report</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 2rem; color: #1e293b; }
  h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
  .meta { color: #64748b; margin-bottom: 1.5rem; font-size: 0.875rem; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #f1f5f9; text-align: left; padding: 0.75rem; font-weight: 600; font-size: 0.875rem; color: #475569; border-bottom: 2px solid #e2e8f0; }
  td { padding: 0.75rem; border-bottom: 1px solid #e2e8f0; font-size: 0.875rem; }
</style></head><body>
<h1>Attendance Report</h1>
<p class="meta">${range.from || 'N/A'} — ${range.to || 'N/A'} | Type: ${reportType}${eventId ? ' | Filtered by event' : ''}</p>
<table><thead><tr><th>#</th><th>Person</th><th>Direction</th><th>Time</th></tr></thead><tbody>${rows || '<tr><td colspan="4" style="text-align:center;color:#94a3b8">No records found</td></tr>'}</tbody></table>
</body></html>`;
  }

  // Build CSV for Excel reports
  async function buildAttendanceCSV(range: { from: string; to: string }, evId: string) {
    if (!tenant) return '';

    let query = supabase
      .from('attendance')
      .select('id, direction, scanned_at, person_id')
      .eq('tenant_id', tenant.id)
      .order('scanned_at', { ascending: false });

    if (range.from) query = query.gte('scanned_at', range.from);
    if (range.to) query = query.lte('scanned_at', range.to + 'T23:59:59');
    if (evId) query = query.eq('event_id', evId);

    const { data: attendance } = await query;

    const personIds = [...new Set((attendance || []).map((a: any) => a.person_id).filter(Boolean))];
    const personMap: Record<string, { first_name: string; last_name: string }> = {};

    if (personIds.length > 0) {
      const { data: persons } = await supabase
        .from('persons')
        .select('id, first_name, last_name')
        .in('id', personIds);
      (persons || []).forEach((p: any) => {
        personMap[p.id] = { first_name: p.first_name, last_name: p.last_name };
      });
    }

    const header = '#,Person,Direction,Time';
    const rows = (attendance || []).map((a: any, i: number) => {
      const person = personMap[a.person_id];
      const name = person ? `${person.first_name} ${person.last_name}` : 'Unknown';
      const direction = a.direction === 'entry' ? 'Entry' : 'Exit';
      const time = new Date(a.scanned_at).toLocaleString();
      return `${i + 1},"${name}",${direction},"${time}"`;
    });

    return [header, ...rows].join('\n');
  }

  // Generate report
  async function handleGenerate() {
    if (!tenant || !user) return;
    setLoading(true);
    setError(null);

    try {
      const range = computeDateRange(reportType);

      if (reportType === 'custom' && (!range.from || !range.to)) {
        throw new Error('Please select both start and end dates for custom reports');
      }

      const reportTitle = `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report — ${range.from} to ${range.to}`;

      // Insert report record
      const { data: newReport, error: insertErr } = await supabase
        .from('reports')
        .insert({
          tenant_id: tenant.id,
          title: reportTitle,
          report_type: reportType,
          date_from: range.from || null,
          date_to: range.to || null,
          format,
          created_by: user.id,
        })
        .select()
        .single();

      if (insertErr) throw insertErr;

      // Build content and trigger download
      if (format === 'pdf') {
        const html = await buildAttendanceHTML(range, eventId);
        const blob = new Blob([html], { type: 'text/html' });
        triggerDownload(blob, `attendance-report-${range.from}.html`);
      } else {
        const csv = await buildAttendanceCSV(range, eventId);
        const blob = new Blob([csv], { type: 'text/csv' });
        triggerDownload(blob, `attendance-report-${range.from}.csv`);
      }

      // Refresh report list
      if (newReport) {
        setReports(prev => [newReport as Report, ...prev]);
      }
    } catch (err: any) {
      setError(err.message || 'Report generation failed');
    } finally {
      setLoading(false);
    }
  }

  function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Download an existing report (regenerate on the fly)
  async function handleDownload(report: Report) {
    try {
      const range = { from: report.date_from || '', to: report.date_to || '' };

      if (report.format === 'pdf') {
        const html = await buildAttendanceHTML(range, eventId);
        const blob = new Blob([html], { type: 'text/html' });
        triggerDownload(blob, `attendance-report-${report.date_from || 'unknown'}.html`);
      } else {
        const csv = await buildAttendanceCSV(range, eventId);
        const blob = new Blob([csv], { type: 'text/csv' });
        triggerDownload(blob, `attendance-report-${report.date_from || 'unknown'}.csv`);
      }
    } catch {
      // silent
    }
  }

  // Hard delete a report
  async function handleDelete(reportId: string) {
    if (!tenant) return;
    try {
      const { error: delErr } = await supabase.from('reports').delete().eq('id', reportId);
      if (delErr) throw delErr;
      setReports(prev => prev.filter(r => r.id !== reportId));
    } catch {
      // silent
    }
  }

  const reportTypeOptions: { value: ReportType; label: string }[] = [
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'custom', label: 'Custom' },
  ];

  const badgeColor: Record<ReportType, string> = {
    daily: 'bg-emerald-100 text-emerald-700',
    weekly: 'bg-blue-100 text-blue-700',
    monthly: 'bg-purple-100 text-purple-700',
    custom: 'bg-amber-100 text-amber-700',
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
        <p className="text-slate-500 mt-1">Generate and manage attendance reports</p>
      </div>

      {/* Generator Card */}
      {isAdmin && (
        <div className="max-w-lg mb-8">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-50 mx-auto mb-6">
              <FileBarChart className="w-8 h-8 text-emerald-600" />
            </div>

            <div className="space-y-4">
              {/* Report Type Selector */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Report Type
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {reportTypeOptions.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setReportType(opt.value)}
                      className={`py-2.5 text-sm font-medium rounded-xl border-2 transition-all ${
                        reportType === opt.value
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                          : 'border-slate-200 text-slate-500 hover:border-slate-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date Range (shown for custom, read-only display for others) */}
              {reportType === 'custom' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">From</label>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={e => setDateFrom(e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">To</label>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={e => setDateTo(e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 rounded-xl px-4 py-3 text-sm text-slate-600">
                  <Calendar className="w-4 h-4 inline mr-2 -mt-0.5" />
                  {(() => {
                    const r = computeDateRange(reportType);
                    return `${r.from} — ${r.to}`;
                  })()}
                </div>
              )}

              {/* Event Filter */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Event (optional)
                </label>
                <select
                  value={eventId}
                  onChange={e => setEventId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">All Events</option>
                  {events.map(ev => (
                    <option key={ev.id} value={ev.id}>
                      {ev.name} — {ev.event_date}
                    </option>
                  ))}
                </select>
              </div>

              {/* Format Selector */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Format</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setFormat('pdf')}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all ${
                      format === 'pdf'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    <FileText className="w-5 h-5" /> PDF
                  </button>
                  <button
                    onClick={() => setFormat('excel')}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all ${
                      format === 'excel'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    <FileSpreadsheet className="w-5 h-5" /> Excel
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm">
                  {error}
                </div>
              )}

              <button
                onClick={handleGenerate}
                disabled={loading}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                {loading ? 'Generating...' : 'Generate Report'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reports List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="px-6 py-5 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">Generated Reports</h2>
        </div>

        {reportsLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="animate-pulse h-16 bg-slate-100 rounded-xl" />
            ))}
          </div>
        ) : reports.length === 0 ? (
          <div className="py-16 text-center">
            <FileBarChart className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">No reports generated yet.</p>
            {isAdmin && (
              <p className="text-slate-400 text-xs mt-1">
                Use the form above to generate your first report.
              </p>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {reports.map(report => (
              <li key={report.id} className="px-6 py-4 flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 truncate">{report.title}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${
                        badgeColor[report.report_type]
                      }`}
                    >
                      {report.report_type}
                    </span>
                    <span className="text-xs text-slate-400">
                      {report.date_from} — {report.date_to}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-600">
                      {report.format === 'pdf' ? 'PDF' : 'Excel'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Created {new Date(report.created_at).toLocaleString()}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleDownload(report)}
                    className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-emerald-600 transition-colors"
                    title="Download"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => handleDelete(report.id)}
                      className="p-2 rounded-lg hover:bg-red-50 text-slate-500 hover:text-red-600 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}


