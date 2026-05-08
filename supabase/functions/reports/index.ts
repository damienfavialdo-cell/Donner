import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function validateUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const tenantId = req.headers.get("X-Tenant-Id") || url.searchParams.get("tenant_id");
    const format = url.searchParams.get("format") || "pdf";
    const eventId = url.searchParams.get("event_id");
    const dateFrom = url.searchParams.get("date_from");
    const dateTo = url.searchParams.get("date_to");

    if (!tenantId || !validateUUID(tenantId)) {
      return new Response(JSON.stringify({ error: "Invalid tenant_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user belongs to tenant
    const { data: tenantUser } = await supabase
      .from("tenant_users")
      .select("role")
      .eq("tenant_id", tenantId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!tenantUser) {
      return new Response(JSON.stringify({ error: "Access denied" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build attendance query
    let query = supabase
      .from("attendance")
      .select("id, direction, scanned_at, notes, member:members(first_name, last_name, barcode_id), event:events(name, event_date)")
      .eq("tenant_id", tenantId)
      .order("scanned_at", { ascending: false });

    if (eventId && validateUUID(eventId)) {
      query = query.eq("event_id", eventId);
    }
    if (dateFrom) {
      query = query.gte("scanned_at", dateFrom);
    }
    if (dateTo) {
      query = query.lte("scanned_at", dateTo);
    }

    const { data: records, error: recordsError } = await query;

    if (recordsError) {
      return new Response(JSON.stringify({ error: "Failed to fetch records" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get tenant info
    const { data: tenant } = await supabase
      .from("tenants")
      .select("name")
      .eq("id", tenantId)
      .maybeSingle();

    if (format === "excel") {
      // Generate CSV (Excel-compatible)
      const headers = ["Member", "Barcode", "Event", "Date", "Direction", "Scanned At", "Notes"];
      const rows = (records || []).map((r: any) => [
        `${r.member?.first_name || ""} ${r.member?.last_name || ""}`,
        r.member?.barcode_id || "",
        r.event?.name || "",
        r.event?.event_date || "",
        r.direction,
        new Date(r.scanned_at).toLocaleString(),
        r.notes || "",
      ]);

      const csvContent = [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
        .join("\n");

      const bom = "\uFEFF";
      const encoder = new TextEncoder();
      const csvBytes = encoder.encode(bom + csvContent);

      return new Response(csvBytes, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="attendance-report-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    // Generate PDF-like HTML report
    const htmlRows = (records || []).map((r: any) => `
      <tr>
        <td style="padding:8px;border:1px solid #ddd;">${r.member?.first_name || ""} ${r.member?.last_name || ""}</td>
        <td style="padding:8px;border:1px solid #ddd;">${r.member?.barcode_id || ""}</td>
        <td style="padding:8px;border:1px solid #ddd;">${r.event?.name || ""}</td>
        <td style="padding:8px;border:1px solid #ddd;">${r.direction === "entry" ? "Entry" : "Exit"}</td>
        <td style="padding:8px;border:1px solid #ddd;">${new Date(r.scanned_at).toLocaleString()}</td>
      </tr>
    `).join("");

    const entryCount = (records || []).filter((r: any) => r.direction === "entry").length;
    const exitCount = (records || []).filter((r: any) => r.direction === "exit").length;

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Attendance Report</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; color: #1a1a2e; }
  h1 { color: #0f3460; border-bottom: 3px solid #0f3460; padding-bottom: 12px; }
  .stats { display: flex; gap: 24px; margin: 20px 0; }
  .stat { background: #f0f4f8; padding: 16px 24px; border-radius: 8px; }
  .stat strong { display: block; font-size: 24px; color: #0f3460; }
  table { width: 100%; border-collapse: collapse; margin-top: 20px; }
  th { background: #0f3460; color: white; padding: 10px 8px; text-align: left; }
  .footer { margin-top: 40px; font-size: 12px; color: #666; }
</style></head>
<body>
  <h1>Attendance Report - ${tenant?.name || "Organization"}</h1>
  <p>Generated: ${new Date().toLocaleString()}</p>
  <div class="stats">
    <div class="stat"><strong>${entryCount}</strong>Entries</div>
    <div class="stat"><strong>${exitCount}</strong>Exits</div>
    <div class="stat"><strong>${(records || []).length}</strong>Total Records</div>
  </div>
  <table>
    <thead><tr><th>Member</th><th>Barcode</th><th>Event</th><th>Direction</th><th>Time</th></tr></thead>
    <tbody>${htmlRows}</tbody>
  </table>
  <div class="footer">ONG MADE Attendance System</div>
</body></html>`;

    const encoder = new TextEncoder();
    const htmlBytes = encoder.encode(html);

    return new Response(htmlBytes, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="attendance-report-${new Date().toISOString().slice(0, 10)}.html"`,
      },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal server error", details: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});


