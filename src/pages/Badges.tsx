import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { useI18n } from '@/i18n';
import type { Person, PersonCategory, Badge } from '@/lib/types';
import { CreditCard, Search, RefreshCw, Download, Printer, Barcode, Eye, Users, X } from 'lucide-react';
import JsBarcode from 'jsbarcode';
import jsPDF from 'jspdf';

interface PersonWithBadge extends Person {
  badge?: Badge;
}

// Category-specific badge colors (professional ONG palette)
const BADGE_COLORS: Record<PersonCategory, { primary: string; secondary: string; header: string; accent: string; label: string }> = {
  beneficiary: { primary: '#059669', secondary: '#d1fae5', header: '#064e3b', accent: '#10b981', label: 'BENEFICIAIRE' },
  child:       { primary: '#2563eb', secondary: '#dbeafe', header: '#1e3a5f', accent: '#3b82f6', label: 'ENFANT' },
  mother:      { primary: '#db2777', secondary: '#fce7f3', header: '#831843', accent: '#ec4899', label: 'MERE' },
  visitor:     { primary: '#d97706', secondary: '#fef3c7', header: '#78350f', accent: '#f59e0b', label: 'VISITEUR' },
  staff:       { primary: '#0d9488', secondary: '#ccfbf1', header: '#134e4a', accent: '#14b8a6', label: 'PERSONNEL' },
};

export default function Badges() {
  const { tenant, tenantRole } = useAuth();
  const { t } = useI18n();
  const [persons, setPersons] = useState<PersonWithBadge[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [previewPerson, setPreviewPerson] = useState<PersonWithBadge | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [barcodeDataUrl, setBarcodeDataUrl] = useState('');

  const barcodeRef = useRef<HTMLCanvasElement>(null);
  const isAdmin = tenantRole ? ['owner', 'admin'].includes(tenantRole) : false;

  useEffect(() => {
    if (!previewPerson) { setBarcodeDataUrl(''); return; }
    const canvas = document.createElement('canvas');
    try {
      JsBarcode(canvas, previewPerson.barcode_id, {
        format: 'CODE128', width: 2, height: 60, displayValue: true, fontSize: 14,
        margin: 5, background: '#ffffff', lineColor: '#0f172a',
      });
      setBarcodeDataUrl(canvas.toDataURL('image/png'));
    } catch { setBarcodeDataUrl(''); }
  }, [previewPerson]);

  const loadData = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    setError(null);
    try {
      const [personsRes, badgesRes] = await Promise.all([
        supabase.from('persons').select('*').eq('tenant_id', tenant.id).eq('active', true).order('last_name'),
        supabase.from('badges').select('*').eq('tenant_id', tenant.id),
      ]);
      if (personsRes.error) throw personsRes.error;
      if (badgesRes.error) throw badgesRes.error;
      const badgeMap = new Map<string, Badge>();
      for (const b of badgesRes.data || []) badgeMap.set(b.person_id, b);
      setPersons((personsRes.data || []).map((p: Person) => ({ ...p, badge: badgeMap.get(p.id) })));
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [tenant]);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return persons;
    return persons.filter(p => `${p.first_name} ${p.last_name} ${p.barcode_id}`.toLowerCase().includes(q));
  }, [persons, search]);

  const generatedCount = persons.filter(p => p.badge).length;

  async function generateBadge(person: PersonWithBadge) {
    if (!tenant || !isAdmin) return;
    setGenerating(person.id);
    setError(null);
    try {
      const barcodeData = person.barcode_id;
      if (person.badge) {
        const { error: err } = await supabase
          .from('badges')
          .update({ barcode_data: barcodeData, regenerated_at: new Date().toISOString() })
          .eq('id', person.badge.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from('badges').insert({
          tenant_id: tenant.id, person_id: person.id, barcode_data: barcodeData,
          generated_at: new Date().toISOString(),
        });
        if (err) throw err;
      }
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Badge generation failed');
    } finally {
      setGenerating(null);
    }
  }

  async function generateAllBadges() {
    if (!tenant || !isAdmin) return;
    setBulkGenerating(true);
    setError(null);
    try {
      const toGenerate = persons.filter(p => selectedIds.has(p.id) && !p.badge);
      const toRegenerate = persons.filter(p => selectedIds.has(p.id) && p.badge);
      const inserts = toGenerate.map(p => ({
        tenant_id: tenant.id, person_id: p.id, barcode_data: p.barcode_id,
        generated_at: new Date().toISOString(),
      }));
      if (inserts.length > 0) {
        const { error: insErr } = await supabase.from('badges').insert(inserts);
        if (insErr) throw insErr;
      }
      for (const p of toRegenerate) {
        if (!p.badge) continue;
        const { error: updErr } = await supabase
          .from('badges')
          .update({ barcode_data: p.barcode_id, regenerated_at: new Date().toISOString() })
          .eq('id', p.badge.id);
        if (updErr) throw updErr;
      }
      setSelectedIds(new Set());
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Bulk generation failed');
    } finally {
      setBulkGenerating(false);
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }
  function toggleSelectAll() {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map(p => p.id)));
  }

  function generateBarcodeDataUrl(barcodeId: string): string {
    const canvas = document.createElement('canvas');
    try {
      JsBarcode(canvas, barcodeId, {
        format: 'CODE128', width: 2, height: 60, displayValue: true, fontSize: 14, margin: 5,
        background: '#ffffff', lineColor: '#0f172a',
      });
      return canvas.toDataURL('image/png');
    } catch { return ''; }
  }

  // Convert image URL to base64 for jsPDF embedding
  async function imageUrlToBase64(url: string): Promise<string> {
    if (url.startsWith('data:')) return url;
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } catch {
      return '';
    }
  }

  async function downloadBadgePdf(person: PersonWithBadge) {
    const colors = BADGE_COLORS[person.category];
    const barcodeImg = generateBarcodeDataUrl(person.barcode_id);
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [105, 70] });

    // Background
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, 105, 70, 'F');

    // Category color header bar
    doc.setFillColor(colors.primary);
    doc.rect(0, 0, 105, 18, 'F');

    // MADE Logo text (top-left)
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('MADE', 5, 8);

    // Category label (top-right)
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(colors.label, 100, 8, { align: 'right' });

    // Subtitle
    doc.setFontSize(6);
    doc.setTextColor(200, 220, 200);
    doc.text('ONG MADE - Gestion des Membres', 5, 14);

    // Accent line
    doc.setFillColor(colors.accent);
    doc.rect(0, 18, 105, 1.5, 'F');

    // Photo area (left side)
    const photoX = 5;
    const photoY = 22;
    const photoW = 22;
    const photoH = 28;

    if (person.photo_url) {
      try {
        const photoBase64 = await imageUrlToBase64(person.photo_url);
        if (photoBase64) {
          doc.addImage(photoBase64, 'JPEG', photoX, photoY, photoW, photoH);
          // Photo border
          doc.setDrawColor(colors.primary);
          doc.setLineWidth(0.3);
          doc.rect(photoX, photoY, photoW, photoH);
        } else {
          drawPhotoPlaceholder(doc, photoX, photoY, photoW, photoH, colors);
        }
      } catch {
        drawPhotoPlaceholder(doc, photoX, photoY, photoW, photoH, colors);
      }
    } else {
      drawPhotoPlaceholder(doc, photoX, photoY, photoW, photoH, colors);
    }

    // Person info (right of photo)
    const infoX = 30;
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text(`${person.first_name} ${person.last_name}`, infoX, 28);

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`ID: ${person.barcode_id}`, infoX, 33);

    if (person.category) {
      doc.setFillColor(colors.secondary);
      doc.roundedRect(infoX, 35, 25, 5, 1, 1, 'F');
      doc.setFontSize(6);
      doc.setTextColor(parseInt(colors.header.slice(1, 3), 16), parseInt(colors.header.slice(3, 5), 16), parseInt(colors.header.slice(5, 7), 16));
      doc.text(colors.label, infoX + 12.5, 38.5, { align: 'center' });
    }

    if (person.phone) {
      doc.setFontSize(6);
      doc.setTextColor(100, 116, 139);
      doc.text(`Tel: ${person.phone}`, infoX, 44);
    }

    // Barcode (bottom section)
    if (barcodeImg) {
      doc.addImage(barcodeImg, 'PNG', 5, 52, 95, 14);
    }

    // Footer line
    doc.setFillColor(colors.primary);
    doc.rect(0, 67, 105, 3, 'F');
    doc.setFontSize(4);
    doc.setTextColor(255, 255, 255);
    doc.text('CODE128 | ONG MADE', 52.5, 69, { align: 'center' });

    doc.save(`badge-${person.barcode_id}.pdf`);
  }

  function drawPhotoPlaceholder(doc: jsPDF, x: number, y: number, w: number, h: number, colors: typeof BADGE_COLORS.beneficiary) {
    doc.setFillColor(colors.secondary);
    doc.rect(x, y, w, h, 'F');
    doc.setDrawColor(colors.primary);
    doc.setLineWidth(0.3);
    doc.rect(x, y, w, h);
    doc.setFontSize(6);
    doc.setTextColor(colors.primary);
    doc.text('PHOTO', x + w / 2, y + h / 2 + 1, { align: 'center' });
  }

  function handlePrint() { window.print(); }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('badges')}</h1>
          <p className="text-slate-500 mt-1">{generatedCount} / {persons.length} generated</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && selectedIds.size > 0 && (
            <button onClick={generateAllBadges} disabled={bulkGenerating}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium rounded-xl transition-all shadow-sm">
              <CreditCard className="w-4 h-4" />
              {bulkGenerating ? '...' : `${t('generate')} (${selectedIds.size})`}
            </button>
          )}
          {isAdmin && (
            <button onClick={() => { const nb = persons.filter(p => !p.badge); if (nb.length > 0) setSelectedIds(new Set(nb.map(p => p.id))); }}
              className="flex items-center gap-2 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition-all text-sm">
              {t('all')} - {t('badges')}
            </button>
          )}
          <button onClick={loadData} className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>}

      {/* Color Legend */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {(Object.entries(BADGE_COLORS) as [PersonCategory, typeof BADGE_COLORS.beneficiary][]).map(([cat, c]) => (
          <span key={cat} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium" style={{ backgroundColor: c.secondary, color: c.header }}>
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.primary }} />
            {c.label}
          </span>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="p-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder={`${t('search')}...`}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
            </div>
            <div className="flex items-center gap-1 text-xs text-slate-500 shrink-0">
              <Barcode className="w-3.5 h-3.5" /> CODE128
            </div>
          </div>
        </div>

        {isAdmin && filtered.length > 0 && (
          <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
              <input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0} onChange={toggleSelectAll}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
              {t('all')}
            </label>
            {selectedIds.size > 0 && <span className="text-xs text-emerald-600 font-medium">{selectedIds.size} selected</span>}
          </div>
        )}

        {loading ? (
          <div className="p-8 text-center text-slate-400">{t('loading')}</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center">
            <CreditCard className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">{t('noData')}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map(p => {
              const colors = BADGE_COLORS[p.category];
              return (
                <div key={p.id} className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50 transition-colors">
                  {isAdmin && (
                    <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelect(p.id)}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 shrink-0" />
                  )}
                  {/* Photo or Avatar */}
                  {p.photo_url ? (
                    <img src={p.photo_url} alt={`${p.first_name} ${p.last_name}`}
                      className="w-10 h-10 rounded-full object-cover shrink-0 border-2 shadow-sm" style={{ borderColor: colors.primary }} />
                  ) : (
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm shrink-0"
                      style={{ backgroundColor: colors.secondary, color: colors.header }}>
                      {(p.first_name?.[0] || '?').toUpperCase()}{(p.last_name?.[0] || '').toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 truncate">{p.first_name} {p.last_name}</p>
                    <p className="text-xs text-slate-500 flex items-center gap-1">
                      <Barcode className="w-3 h-3" /> {p.barcode_id}
                    </p>
                  </div>
                  {/* Category badge with color */}
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium shrink-0"
                    style={{ backgroundColor: colors.secondary, color: colors.header }}>
                    {colors.label}
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${p.badge ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                    {p.badge ? t('active') : t('inactive')}
                  </span>
                  <div className="flex items-center gap-1">
                    {p.badge && (
                      <>
                        <button onClick={() => setPreviewPerson(p)} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Preview">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button onClick={() => downloadBadgePdf(p)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Download PDF">
                          <Download className="w-4 h-4" />
                        </button>
                        <button onClick={handlePrint} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors" title="Print">
                          <Printer className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    {isAdmin && (
                      !p.badge ? (
                        <button onClick={() => generateBadge(p)} disabled={generating === p.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-all">
                          <CreditCard className="w-3.5 h-3.5" /> {generating === p.id ? '...' : t('generate')}
                        </button>
                      ) : (
                        <button onClick={() => generateBadge(p)} disabled={generating === p.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition-all">
                          <RefreshCw className="w-3.5 h-3.5" /> {generating === p.id ? '...' : t('regenerate')}
                        </button>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Preview Modal - Professional badge preview */}
      {previewPerson && (() => {
        const colors = BADGE_COLORS[previewPerson.category];
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setPreviewPerson(null)}>
            <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-900">Badge Preview</h2>
                <button onClick={() => setPreviewPerson(null)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Badge Card Preview */}
              <div className="rounded-xl overflow-hidden shadow-lg border" style={{ borderColor: colors.primary }}>
                {/* Header */}
                <div className="px-4 py-3 flex items-center justify-between" style={{ backgroundColor: colors.primary }}>
                  <div>
                    <p className="text-white font-bold text-lg">MADE</p>
                    <p className="text-white/70 text-xs">ONG MADE - Gestion des Membres</p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'white' }}>
                    {colors.label}
                  </span>
                </div>

                {/* Accent line */}
                <div className="h-1" style={{ backgroundColor: colors.accent }} />

                {/* Body */}
                <div className="p-4 flex gap-4">
                  {/* Photo */}
                  {previewPerson.photo_url ? (
                    <img src={previewPerson.photo_url} alt="Photo"
                      className="w-20 h-24 rounded-lg object-cover border-2 shrink-0" style={{ borderColor: colors.primary }} />
                  ) : (
                    <div className="w-20 h-24 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: colors.secondary }}>
                      <Users className="w-8 h-8" style={{ color: colors.primary }} />
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-lg font-bold text-slate-900">{previewPerson.first_name} {previewPerson.last_name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">ID: {previewPerson.barcode_id}</p>
                    <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{ backgroundColor: colors.secondary, color: colors.header }}>
                      {colors.label}
                    </span>
                    {previewPerson.phone && (
                      <p className="text-xs text-slate-500 mt-1.5">Tel: {previewPerson.phone}</p>
                    )}
                  </div>
                </div>

                {/* Barcode */}
                {barcodeDataUrl && (
                  <div className="px-4 pb-3">
                    <div className="bg-white rounded-lg p-2 border border-slate-100">
                      <img src={barcodeDataUrl} alt="CODE128 Barcode" className="mx-auto max-w-full" />
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div className="px-4 py-1.5 text-center" style={{ backgroundColor: colors.primary }}>
                  <p className="text-white text-xs font-medium">CODE128 | ONG MADE</p>
                </div>
              </div>

              <div className="flex items-center gap-3 mt-4">
                <button onClick={handlePrint}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition-all text-sm">
                  <Printer className="w-4 h-4" /> {t('print')}
                </button>
                <button onClick={() => downloadBadgePdf(previewPerson)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl transition-all text-sm">
                  <Download className="w-4 h-4" /> {t('downloadPdf')}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      <canvas ref={barcodeRef} className="hidden" />
    </div>
  );
}


