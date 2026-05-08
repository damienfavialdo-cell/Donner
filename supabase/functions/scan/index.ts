import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ScanRequest {
  barcode_id: string;
  tenant_id: string;
  event_id?: string;
}

function validateUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
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

    const body: ScanRequest = await req.json();
    const { barcode_id, tenant_id, event_id } = body;

    if (!barcode_id || typeof barcode_id !== "string" || barcode_id.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Invalid barcode_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!validateUUID(tenant_id)) {
      return new Response(JSON.stringify({ error: "Invalid tenant_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user belongs to tenant
    const { data: tenantUser, error: tuError } = await supabase
      .from("tenant_users")
      .select("role")
      .eq("tenant_id", tenant_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (tuError || !tenantUser) {
      return new Response(JSON.stringify({ error: "Access denied for this tenant" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["owner", "admin", "scanner"].includes(tenantUser.role)) {
      return new Response(JSON.stringify({ error: "Insufficient permissions to scan" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify event if provided
    if (event_id && validateUUID(event_id)) {
      const { data: event, error: eventError } = await supabase
        .from("events")
        .select("id, status")
        .eq("id", event_id)
        .eq("tenant_id", tenant_id)
        .maybeSingle();

      if (eventError || !event) {
        return new Response(JSON.stringify({ error: "Event not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Find person by barcode (check persons table first, then members)
    let person: any = null;
    let personSource = "persons";

    const { data: personData, error: personError } = await supabase
      .from("persons")
      .select("*")
      .eq("tenant_id", tenant_id)
      .eq("barcode_id", barcode_id.trim())
      .eq("active", true)
      .maybeSingle();

    if (personData) {
      person = personData;
    } else {
      // Fallback to members table for backward compatibility
      const { data: memberData, error: memberError } = await supabase
        .from("members")
        .select("*")
        .eq("tenant_id", tenant_id)
        .eq("barcode_id", barcode_id.trim())
        .eq("active", true)
        .maybeSingle();

      if (memberData) {
        person = memberData;
        personSource = "members";
      }
    }

    if (!person) {
      return new Response(JSON.stringify({ error: "Person not found with this barcode" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get last attendance record to determine direction
    const personId = personSource === "persons" ? person.id : null;
    const memberId = personSource === "members" ? person.id : null;

    let lastRecordQuery = supabase
      .from("attendance")
      .select("direction, scanned_at")
      .eq("tenant_id", tenant_id)
      .order("scanned_at", { ascending: false })
      .limit(1);

    if (personId) {
      lastRecordQuery = lastRecordQuery.eq("person_id", personId);
    } else {
      lastRecordQuery = lastRecordQuery.eq("member_id", memberId);
    }

    if (event_id && validateUUID(event_id)) {
      lastRecordQuery = lastRecordQuery.eq("event_id", event_id);
    }

    const { data: lastRecord } = await lastRecordQuery.maybeSingle();

    // Determine direction: toggle from last record
    const direction = lastRecord?.direction === "entry" ? "exit" : "entry";

    // 5-second duplicate scan prevention
    if (lastRecord?.scanned_at) {
      const lastScanTime = new Date(lastRecord.scanned_at).getTime();
      const now = Date.now();
      if (now - lastScanTime < 5000) {
        return new Response(JSON.stringify({
          error: "Duplicate scan - please wait 5 seconds",
          details: `Last scan was ${Math.round((now - lastScanTime) / 1000)}s ago`,
        }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Insert attendance record
    const attendanceData: Record<string, any> = {
      tenant_id,
      direction,
      scanned_by: user.id,
    };

    if (personId) attendanceData.person_id = personId;
    if (memberId) attendanceData.member_id = memberId;
    if (event_id && validateUUID(event_id)) attendanceData.event_id = event_id;

    const { data: attendance, error: insertError } = await supabase
      .from("attendance")
      .insert(attendanceData)
      .select()
      .single();

    if (insertError) {
      return new Response(JSON.stringify({ error: "Failed to record attendance", details: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      direction,
      person: {
        id: person.id,
        first_name: person.first_name,
        last_name: person.last_name,
        barcode_id: person.barcode_id,
        category: person.category || personSource,
      },
      message: `${direction === "entry" ? "Entry" : "Exit"} recorded for ${person.first_name} ${person.last_name}`,
      attendance,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal server error", details: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});


