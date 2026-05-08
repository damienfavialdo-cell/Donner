const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || err.details || `HTTP ${res.status}`);
  }

  return res.json();
}

export async function scanBarcode(barcodeId: string, tenantId: string, eventId: string | null, authToken: string) {
  return apiFetch<import('@/lib/types').ScanResult>('/scan', {
    method: 'POST',
    headers: { Authorization: `Bearer ${authToken}` },
    body: JSON.stringify({ barcode_id: barcodeId, tenant_id: tenantId, event_id: eventId }),
  });
}

export async function generateReport(tenantId: string, authToken: string, format: 'pdf' | 'excel', params: Record<string, string>) {
  const query = new URLSearchParams({ format, ...params }).toString();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/reports?${query}`, {
    headers: {
      Authorization: `Bearer ${authToken}`,
      'X-Tenant-Id': tenantId,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Report generation failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res;
}

export async function createCheckoutSession(tenantId: string, priceId: string, authToken: string) {
  return apiFetch<{ url: string }>('/stripe-checkout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${authToken}` },
    body: JSON.stringify({ tenant_id: tenantId, price_id: priceId }),
  });
}

export async function createPortalSession(tenantId: string, authToken: string) {
  return apiFetch<{ url: string }>('/stripe-portal', {
    method: 'POST',
    headers: { Authorization: `Bearer ${authToken}` },
    body: JSON.stringify({ tenant_id: tenantId }),
  });
}


