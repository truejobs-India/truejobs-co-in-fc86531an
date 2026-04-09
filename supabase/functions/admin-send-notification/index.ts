import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1?target=denonext";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_GATEWAY = "https://connector-gateway.lovable.dev/resend";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
    console.error("Auth failed:", claimsError?.message);
    return new Response(JSON.stringify({ error: "Unauthorized", detail: claimsError?.message || "Invalid token" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userId = claimsData.claims.sub;
  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: roleCheck } = await adminClient.rpc("has_role", { _user_id: userId, _role: "admin" });

  if (!roleCheck) {
    return new Response(JSON.stringify({ error: "Admin role required" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { channel: string; subject?: string; message_body: string; cta_label?: string; cta_url?: string; test_email?: string; audience_filter?: Record<string, unknown> };
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!body.channel || !body.message_body) {
    return new Response(JSON.stringify({ error: "channel and message_body are required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (body.channel === "email") {
    return await handleEmail(adminClient, userId, body);
  } else if (body.channel === "telegram") {
    return await handleTelegram(adminClient, userId, body);
  }
  return new Response(JSON.stringify({ error: `Unsupported channel: ${body.channel}` }), {
    status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function handleEmail(db: ReturnType<typeof createClient>, userId: string, body: any) {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (!resendKey || !lovableKey) {
    return new Response(JSON.stringify({ error: "Email not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let recipients: { email: string }[] = [];
  if (body.test_email) {
    recipients = [{ email: body.test_email }];
  } else {
    const { data } = await db.from("email_subscribers").select("email").eq("is_active", true);
    recipients = data || [];
  }
  if (!recipients.length) {
    return new Response(JSON.stringify({ error: "No recipients" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const cta = body.cta_label && body.cta_url
    ? `<p style="margin:24px 0"><a href="${esc(body.cta_url)}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">${esc(body.cta_label)}</a></p>` : "";
  const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h2>${esc(body.subject || "Job Alert")}</h2><div style="line-height:1.6">${body.message_body.replace(/\n/g, "<br>")}</div>${cta}<hr style="border:none;border-top:1px solid #eee;margin:32px 0"><p style="color:#999;font-size:12px">You received this because you subscribed to TrueJobs alerts.</p></div>`;

  const { data: logData } = await db.from("notification_send_log").insert({
    channel: "email", subject: body.subject || "Job Alert", message_body: body.message_body.substring(0, 500),
    cta_label: body.cta_label, cta_url: body.cta_url,
    audience_filter: body.test_email ? { test_email: body.test_email } : (body.audience_filter || {}),
    audience_count: recipients.length, sent_count: 0, failed_count: 0, sent_by: userId, status: "sending",
  }).select("id").single();

  let sent = 0, failed = 0;
  for (let i = 0; i < recipients.length; i += 10) {
    const batch = recipients.slice(i, i + 10);
    const results = await Promise.allSettled(batch.map(r =>
      fetch(`${RESEND_GATEWAY}/emails`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": resendKey },
        body: JSON.stringify({ from: "TrueJobs Alerts <alerts@resend.dev>", to: [r.email], subject: body.subject || "Job Alert from TrueJobs", html }),
      }).then(res => { if (!res.ok) throw new Error(`${res.status}`); return res; })
    ));
    for (const r of results) r.status === "fulfilled" ? sent++ : failed++;
    if (i + 10 < recipients.length) await new Promise(r => setTimeout(r, 200));
  }

  if (logData?.id) {
    await db.from("notification_send_log").update({
      sent_count: sent, failed_count: failed, status: failed === 0 ? "completed" : sent > 0 ? "partial" : "failed",
    }).eq("id", logData.id);
  }

  return new Response(JSON.stringify({ success: true, sent_count: sent, failed_count: failed }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleTelegram(db: ReturnType<typeof createClient>, userId: string, body: any) {
  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!botToken) {
    return new Response(JSON.stringify({ error: "Telegram bot token not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: subs } = await db.from("telegram_subscribers").select("telegram_chat_id").eq("is_active", true);
  if (!subs?.length) {
    return new Response(JSON.stringify({ error: "No Telegram subscribers" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let text = body.message_body;
  if (body.cta_label && body.cta_url) text += `\n\n<a href="${body.cta_url}">${body.cta_label}</a>`;

  const { data: logData } = await db.from("notification_send_log").insert({
    channel: "telegram", subject: body.subject, message_body: body.message_body.substring(0, 500),
    audience_count: subs.length, sent_count: 0, failed_count: 0, sent_by: userId, status: "sending",
  }).select("id").single();

  let sent = 0, failed = 0;
  for (const s of subs) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: s.telegram_chat_id, text, parse_mode: "HTML" }),
      });
      res.ok ? sent++ : failed++;
    } catch { failed++; }
    await new Promise(r => setTimeout(r, 50));
  }

  if (logData?.id) {
    await db.from("notification_send_log").update({
      sent_count: sent, failed_count: failed, status: failed === 0 ? "completed" : sent > 0 ? "partial" : "failed",
    }).eq("id", logData.id);
  }

  return new Response(JSON.stringify({ success: true, sent_count: sent, failed_count: failed }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
