import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { useI18n } from '@/i18n';
import { Download, FileSpreadsheet, FileText, File } from 'lucide-react';
import type { PersonCategory } from '@/lib/types';

type DataSource = 'persons' | 'attendance' | 'cantine' | 'gargote' | 'medical_records' | 'events';
type ExportFormat = 'csv' | 'xlsx' | 'pdf';

interface DataSourceOption {
  key: DataSource;
  labelKey: string;
  table: string;
}

interface ExportRecord {
  id: number;
  source: DataSource;
  format: ExportFormat;
  rowCount: number;
  createdAt: Date;
}

const DATA_SOURCES: DataSourceOption[] = [
  { key: 'persons', labelKey: 'persons', table: 'persons' },
  { key: 'attendance', labelKey: 'attendance', table: 'attendance' },
  { key: 'cantine', labelKey: 'cantine', table: 'cantine' },
  { key: 'gargote', labelKey: 'gargote', table: 'gargote' },
  { key: 'medical_records', labelKey: 'medical_records', table: 'medical_records' },
  { key: 'events', labelKey: 'events', table: 'events' },
];

const FORMAT_OPTIONS: { key: ExportFormat; labelKey: string; icon: typeof File; extension: string }[] = [
  { key: 'csv', labelKey: 'csv', icon: FileText, extension: '.csv' },
  { key: 'xlsx', labelKey: 'excel', icon: FileSpreadsheet, extension: '.xlsx' },
  { key: 'pdf', labelKey: 'pdf', icon: File, extension: '.html' },
];

const PERSON_CATEGORIES: { value: PersonCategory | ''; labelKey: string }[] = [
  { value: '', labelKey: 'all_categories' },
  { value: 'beneficiary', labelKey: 'beneficiary' },
  { value: 'child', labelKey: 'child' },
  { value: 'mother', labelKey: 'mother' },
  { value: 'visitor', labelKey: 'visitor' },
  { value: 'staff', labelKey: 'staff' },
];

function buildCSV(data: Record<string, unknown>[]): string {
  if (data.length === 0) return '';
  const headers = Object.keys(data[0]);
  const rows = data.map(row => headers.map(h => {
    const val = row[h] ?? '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }).join(','));
  return [headers.join(','), ...rows].join('\n');
}

function buildHTMLTable(data: Record<string, unknown>[], title: string): string {
  if (data.length === 0) return '';
  const headers = Object.keys(data[0]);
  const headerRow = headers.map(h => `<th style="border:1px solid #ccc;padding:8px;background:#f5f5f5;text-align:left">${h}</th>`).join('');
  const bodyRows = data.map(row =>
    '<tr>' + headers.map(h => `<td style="border:1px solid #ccc;padding:8px">${String(row[h] ?? '')}</td>`).join('') + '</tr>'
  ).join('\n');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title></head><body><h1>${title}</h1><table style="border-collapse:collapse;width:100%">${headerRow}${bodyRows}</table></body></html>`;
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

export default function Export() {
  const { tenant } = useAuth();
  const { t } = useI18n();

  const [dataSource, setDataSource] = useState<DataSource>('persons');
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [category, setCategory] = useState<PersonCategory | ''>('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentExports, setRecentExports] = useState<ExportRecord[]>([]);
  const [rowCount, setRowCount] = useState<number | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const sourceConfig = DATA_SOURCES.find(s => s.key === dataSource);

  // Preview count when params change
  useEffect(() => {
    if (!tenant) {
      setRowCount(null);
      return;
    }

    let mounted = true;
    const tid = tenant.id;

    (async () => {
      setPreviewing(true);
      try {
        let query = supabase
          .from(sourceConfig!.table)
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tid);

        if (dataSource === 'persons' && category) {
          query = query.eq('category', category);
        }

        if (dateFrom) {
          query = query.gte('created_at', dateFrom);
        }
        if (dateTo) {
          query = query.lte('created_at', `${dateTo}T23:59:59`);
        }

        const { count, error: err } = await query;
        if (!mounted) return;
        if (err) {
          setRowCount(null);
          return;
        }
        setRowCount(count ?? 0);
      } catch {
        if (mounted) setRowCount(null);
      } finally {
        if (mounted) setPreviewing(false);
      }
    })();

    return () => { mounted = false; };
  }, [tenant, dataSource, category, dateFrom, dateTo, sourceConfig]);

  async function handleGenerate() {
    if (!tenant || !sourceConfig) return;
    setGenerating(true);
    setError(null);

    try {
      let query = supabase
        .from(sourceConfig.table)
        .select('*')
        .eq('tenant_id', tenant.id);

      if (dataSource === 'persons' && category) {
        query = query.eq('category', category);
      }

      if (dateFrom) {
        query = query.gte('created_at', dateFrom);
      }
      if (dateTo) {
        query = query.lte('created_at', `${dateTo}T23:59:59`);
      }

      const { data, error: err } = await query;
      if (err) throw err;

      const rows = (data || []) as Record<string, unknown>[];
      if (rows.length === 0) {
        setError(t('no_data_to_export'));
        return;
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const baseName = `${dataSource}_export_${timestamp}`;

      if (format === 'csv') {
        const csvString = buildCSV(rows);
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8' });
        triggerDownload(blob, `${baseName}.csv`);
      } else if (format === 'xlsx') {
        const XLSX = await import('xlsx');
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, dataSource);
        XLSX.writeFile(wb, `${baseName}.xlsx`);
      } else if (format === 'pdf') {
        const title = `${t(dataSource)} — ${tenant.name} — ${new Date().toLocaleDateString()}`;
        const html = buildHTMLTable(rows, title);
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        triggerDownload(blob, `${baseName}.html`);
      }

      // Record in recent exports
      setRecentExports(prev => [{
        id: Date.now(),
        source: dataSource,
        format,
        rowCount: rows.length,
        createdAt: new Date(),
      }, ...prev].slice(0, 10));
    } catch (err: any) {
      setError(err.message || t('export_failed'));
    } finally {
      setGenerating(false);
    }
  }

  const FORMAT_ICON_MAP: Record<ExportFormat, typeof File> = {
    csv: FileText,
    xlsx: FileSpreadsheet,
    pdf: File,
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">{t('export_data')}</h1>
        <p className="text-slate-500 mt-1">{t('export_data_desc')}</p>
      </div>

      {/* Export Configuration Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-8">
        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-50 mx-auto mb-4">
          <Download className="w-8 h-8 text-emerald-600" />
        </div>

        <div className="max-w-lg mx-auto space-y-5">
          {/* Data Source */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('data_source')}</label>
            <div className="grid grid-cols-3 gap-2">
              {DATA_SOURCES.map(src => (
                <button
                  key={src.key}
                  type="button"
                  onClick={() => {
                    setDataSource(src.key);
                    setCategory('');
                  }}
                  className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-all border ${
                    dataSource === src.key
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {t(src.labelKey)}
                </button>
              ))}
            </div>
          </div>

          {/* Export Format */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('export_format')}</label>
            <div className="flex gap-2">
              {FORMAT_OPTIONS.map(fmt => {
                const Icon = fmt.icon;
                return (
                  <button
                    key={fmt.key}
                    type="button"
                    onClick={() => setFormat(fmt.key)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all border ${
                      format === fmt.key
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {t(fmt.labelKey)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date Range */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('date_range')} <span className="text-slate-400 font-normal">({t('optional')})</span></label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  placeholder={t('from')}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
                <span className="text-xs text-slate-400 mt-0.5 block">{t('from')}</span>
              </div>
              <div>
                <input
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  placeholder={t('to')}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
                <span className="text-xs text-slate-400 mt-0.5 block">{t('to')}</span>
              </div>
            </div>
          </div>

          {/* Category Filter (only for persons) */}
          {dataSource === 'persons' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('category_filter')} <span className="text-slate-400 font-normal">({t('optional')})</span></label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value as PersonCategory | '')}
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                {PERSON_CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>{t(cat.labelKey)}</option>
                ))}
              </select>
            </div>
          )}

          {/* Row count preview */}
          <div className="text-sm text-slate-500 text-center">
            {previewing ? (
              t('counting_rows')
            ) : rowCount !== null ? (
              `${rowCount} ${t('rows_found')}`
            ) : null}
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={generating || rowCount === 0}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            {generating ? t('generating') : t('generate_export')}
          </button>
        </div>
      </div>

      {/* Recent Exports Card */}
      {recentExports.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="p-4 border-b border-slate-100">
            <h2 className="text-lg font-semibold text-slate-900">{t('recent_exports')}</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {recentExports.map(exp => {
              const Icon = FORMAT_ICON_MAP[exp.format];
              const fmtOption = FORMAT_OPTIONS.find(f => f.key === exp.format);
              return (
                <div key={exp.id} className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50 transition-colors">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    exp.format === 'csv' ? 'bg-blue-50 text-blue-600' :
                    exp.format === 'xlsx' ? 'bg-emerald-50 text-emerald-600' :
                    'bg-amber-50 text-amber-600'
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900">
                      {t(exp.source)} — {t(exp.format === 'xlsx' ? 'excel' : exp.format)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {exp.rowCount} {t('rows')} · {exp.createdAt.toLocaleString()}
                    </p>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium shrink-0 ${
                    exp.format === 'csv' ? 'bg-blue-50 text-blue-700' :
                    exp.format === 'xlsx' ? 'bg-emerald-50 text-emerald-700' :
                    'bg-amber-50 text-amber-700'
                  }`}>
                    {fmtOption?.extension}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}


