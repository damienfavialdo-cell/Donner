import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { scanBarcode } from '@/lib/api';
import type { Event } from '@/lib/types';
import { ScanLine, ArrowUpRight, ArrowDownRight, AlertCircle, CheckCircle2, Keyboard } from 'lucide-react';

const COOLDOWN_MS = 5000;
const USB_KEY_INTERVAL_MS = 50;

export default function Scanner() {
  const { tenant, user } = useAuth();
  const [barcode, setBarcode] = useState('');
  const [selectedEvent, setSelectedEvent] = useState('');
  const [events, setEvents] = useState<Event[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    direction: 'entry' | 'exit';
    message: string;
    person?: { first_name: string; last_name: string; barcode_id: string; category: string };
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [usbActive, setUsbActive] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const usbBufferRef = useRef<string>('');
  const lastKeystrokeRef = useRef<number>(0);
  const usbTypingRef = useRef<boolean>(false);
  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load events
  useEffect(() => {
    if (!tenant) {
      setEventsLoading(false);
      return;
    }
    const tid = tenant.id;
    let mounted = true;
    (async () => {
      setEventsLoading(true);
      try {
        const { data, error: err } = await supabase
          .from('events')
          .select('*')
          .eq('tenant_id', tid)
          .in('status', ['scheduled', 'active'])
          .order('event_date', { ascending: false });
        if (!mounted) return;
        if (err) {
          setError('Failed to load events');
          return;
        }
        setEvents(data || []);
        if (data?.length) setSelectedEvent(data[0].id);
      } catch {
        if (mounted) setError('Network error loading events');
      } finally {
        if (mounted) setEventsLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [tenant]);

  // Auto-focus the barcode input on mount and after scans
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Cooldown countdown
  useEffect(() => {
    if (cooldown <= 0) return;
    cooldownTimerRef.current = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 100) {
          if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
          return 0;
        }
        return prev - 100;
      });
    }, 100);
    return () => {
      if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    };
  }, [cooldown]);

  // Process a captured barcode (from USB or manual submit)
  const processBarcode = useCallback(async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed || !selectedEvent || !tenant || !user || scanning || cooldown > 0) return;

    setScanning(true);
    setResult(null);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const res = await scanBarcode(trimmed, tenant.id, selectedEvent, session.access_token);
      setResult(res);
      setBarcode('');
      setCooldown(COOLDOWN_MS);
    } catch (err: any) {
      setError(err.message || 'Scan failed');
      setResult(null);
    } finally {
      setScanning(false);
      inputRef.current?.focus();
    }
  }, [selectedEvent, tenant, user, scanning, cooldown]);

  // USB barcode scanner detection via keydown on window
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't capture if a form input (other than the barcode input) is focused
      const active = document.activeElement;
      const isBarcodeInput = active === inputRef.current;
      if (active && active instanceof HTMLElement && !isBarcodeInput &&
          (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT')) {
        return;
      }

      const now = Date.now();
      const timeSinceLast = now - lastKeystrokeRef.current;
      lastKeystrokeRef.current = now;

      if (e.key === 'Enter') {
        // Submit whatever is in the USB buffer
        if (usbBufferRef.current.length >= 3 && usbTypingRef.current) {
          e.preventDefault();
          const captured = usbBufferRef.current;
          usbBufferRef.current = '';
          usbTypingRef.current = false;
          setUsbActive(false);
          setBarcode(captured);
          processBarcode(captured);
        }
        return;
      }

      // Only capture printable characters
      if (e.key.length !== 1) return;

      // Detect rapid typing (USB scanner) vs slow typing (human)
      if (timeSinceLast < USB_KEY_INTERVAL_MS || (usbBufferRef.current.length === 0 && usbTypingRef.current)) {
        usbTypingRef.current = true;
        setUsbActive(true);
        usbBufferRef.current += e.key;

        // Prevent the character from reaching the focused input when USB is detected
        if (!isBarcodeInput) {
          e.preventDefault();
        }
      } else {
        // Too slow — reset USB detection, this looks like human typing
        usbTypingRef.current = false;
        usbBufferRef.current = '';
        setUsbActive(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [processBarcode]);

  // Manual form submit
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!barcode.trim()) return;
    await processBarcode(barcode);
  }

  const cooldownPercent = cooldown > 0 ? ((COOLDOWN_MS - cooldown) / COOLDOWN_MS) * 100 : 100;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Barcode Scanner</h1>
        <p className="text-slate-500 mt-1">Scan member barcodes to record attendance</p>
      </div>

      <div className="max-w-lg mx-auto">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          {/* Header icon */}
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-50 mx-auto mb-4">
            <ScanLine className="w-8 h-8 text-emerald-600" />
          </div>

          {/* USB scanner active indicator */}
          <div className={`flex items-center justify-center gap-2 mb-6 text-sm font-medium transition-all duration-300 ${usbActive ? 'text-emerald-600' : 'text-slate-400'}`}>
            <Keyboard className="w-4 h-4" />
            <span>USB Scanner {usbActive ? 'Active' : 'Ready'}</span>
            {usbActive && <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span></span>}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Event selector */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Event</label>
              {eventsLoading ? (
                <div className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-400 text-sm">Loading events...</div>
              ) : (
                <select
                  value={selectedEvent}
                  onChange={e => setSelectedEvent(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  <option value="">Select event...</option>
                  {events.map(ev => (
                    <option key={ev.id} value={ev.id}>{ev.name} &mdash; {ev.event_date}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Barcode input */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Barcode</label>
              <input
                ref={inputRef}
                type="text"
                value={barcode}
                onChange={e => setBarcode(e.target.value)}
                placeholder="Scan or type barcode..."
                disabled={cooldown > 0 || scanning}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-lg font-mono text-center focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:opacity-50 disabled:bg-slate-50"
                autoFocus
              />
            </div>

            {/* Cooldown indicator */}
            {cooldown > 0 && (
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-100 ease-linear"
                  style={{ width: `${cooldownPercent}%` }}
                />
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={scanning || !barcode.trim() || !selectedEvent || cooldown > 0}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all shadow-lg shadow-emerald-600/20"
            >
              {scanning ? 'Processing...' : cooldown > 0 ? `Cooldown (${Math.ceil(cooldown / 1000)}s)` : 'Record Scan'}
            </button>
          </form>

          {/* Success result: entry (green) or exit (amber) */}
          {result && (
            <div className={`mt-4 p-4 rounded-xl border ${
              result.direction === 'entry'
                ? 'bg-emerald-50 border-emerald-200'
                : 'bg-amber-50 border-amber-200'
            }`}>
              <div className="flex items-center gap-3">
                {result.direction === 'entry' ? (
                  <ArrowUpRight className="w-6 h-6 text-emerald-600 shrink-0" />
                ) : (
                  <ArrowDownRight className="w-6 h-6 text-amber-600 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className={`font-semibold ${result.direction === 'entry' ? 'text-emerald-800' : 'text-amber-800'}`}>
                    {result.direction === 'entry' ? 'ENTRY' : 'EXIT'}
                    {result.person && ` — ${result.person.first_name} ${result.person.last_name}`}
                  </p>
                  <p className="text-sm text-slate-600">{result.message}</p>
                </div>
                <CheckCircle2 className={`w-5 h-5 ml-auto shrink-0 ${result.direction === 'entry' ? 'text-emerald-500' : 'text-amber-500'}`} />
              </div>
            </div>
          )}

          {/* Error result (red) */}
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


