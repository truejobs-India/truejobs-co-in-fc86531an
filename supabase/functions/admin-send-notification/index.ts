import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.49.1/cors";

const RESEND_GATEWAY = "https://connector-gateway.lovable.dev/resend";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Auth-first: validate admin
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userId = claimsData.claims.sub as string;

  // Check admin role using service role client
  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: roleCheck } = await adminClient.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });

  if (!roleCheck) {
    return new Response(JSON.stringify({ error: "Admin role required" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Parse body
  let body: {
    channel: string;
    subject?: string;
    message_body: string;
    cta_label?: string;
    cta_url?: string;
    test_email?: string;
    audience_filter?: Record<string, unknown>;
  };

  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!body.channel || !body.message_body) {
    return new Response(
      JSON.stringify({ error: "channel and message_body are required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (body.channel === "email") {
    return await handleEmailSend(adminClient, userId, body);
  } else if (body.channel === "telegram") {
    return await handleTelegramSend(adminClient, userId, body);
  } else {
    return new Response(
      JSON.stringify({ error: `Unsupported channel: ${body.channel}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function handleEmailSend(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
  body: {
    subject?: string;
    message_body: string;
    cta_label?: string;
    cta_url?: string;
    test_email?: string;
    audience_filter?: Record<string, unknown>;
  }
) {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

  if (!resendApiKey || !lovableApiKey) {
    return new Response(
      JSON.stringify({ error: "Email sending not configured (missing API keys)" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Get recipients
  let recipients: { email: string }[] = [];

  if (body.test_email) {
    recipients = [{ email: body.test_email }];
  } else {
    const { data, error } = await adminClient
      .from("email_subscribers")
      .select("email")
      .eq("is_active", true);

    if (error) {
      return new Response(JSON.stringify({ error: "Failed to fetch subscribers" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    recipients = data || [];
  }

  if (recipients.length === 0) {
    return new Response(JSON.stringify({ error: "No recipients found" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Build HTML
  const ctaHtml = body.cta_label && body.cta_url
    ? `<p style="margin:24px 0"><a href="${escapeHtml(body.cta_url)}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">${escapeHtml(body.cta_label)}</a></p>`
    : "";

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
      <h2 style="color:#1a1a1a">${escapeHtml(body.subject || "Job Alert from TrueJobs")}</h2>
      <div style="color:#333;line-height:1.6">${body.message_body.replace(/\n/g, "<br>")}</div>
      ${ctaHtml}
      <hr style="border:none;border-top:1px solid #eee;margin:32px 0">
      <p style="color:#999;font-size:12px">You received this because you subscribed to TrueJobs alerts.<br>
      To unsubscribe, reply to this email with "unsubscribe".</p>
    </div>
  `;

  // Log the send attempt
  const { data: logData } = await adminClient.from("notification_send_log").insert({
    channel: "email",
    subject: body.subject || "Job Alert",
    message_body: body.message_body.substring(0, 500),
    cta_label: body.cta_label,
    cta_url: body.cta_url,
    audience_filter: body.test_email ? { test_email: body.test_email } : (body.audience_filter || {}),
    audience_count: recipients.length,
    sent_count: 0,
    failed_count: 0,
    sent_by: userId,
    status: "sending",
  }).select("id").single();

  const logId = logData?.id;

  // Send in batches
  let sentCount = 0;
  let failedCount = 0;
  const batchSize = 10;

  for (let i = 0; i < recipients.length; i += batchSize) {
    const batch = recipients.slice(i, i + batchSize);

    const results = await Promise.allSettled(
      batch.map(async (r) => {
        const res = await fetch(`${RESEND_GATEWAY}/emails`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${lovableApiKey}`,
            "X-Connection-Api-Key": resendApiKey,
          },
          body: JSON.stringify({
            from: "TrueJobs Alerts <alerts@resend.dev>",
            to: [r.email],
            subject: body.subject || "Job Alert from TrueJobs",
            html,
          }),
        });
        if (!res.ok) throw new Error(`${res.status}`);
        return res;
      })
    );

    for (const r of results) {
      if (r.status === "fulfilled") sentCount++;
      else failedCount++;
    }

    // Rate limit delay between batches
    if (i + batchSize < recipients.length) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  // Update log
  if (logId) {
    await adminClient
      .from("notification_send_log")
      .update({
        sent_count: sentCount,
        failed_count: failedCount,
        status: failedCount === 0 ? "completed" : sentCount > 0 ? "partial" : "failed",
      })
      .eq("id", logId);
  }

  return new Response(
    JSON.stringify({ success: true, sent_count: sentCount, failed_count: failedCount }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handleTelegramSend(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
  body: {
    message_body: string;
    subject?: string;
    cta_label?: string;
    cta_url?: string;
    audience_filter?: Record<string, unknown>;
  }
) {
  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!botToken) {
    return new Response(
      JSON.stringify({ error: "Telegram bot token not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { data: subscribers } = await adminClient
    .from("telegram_subscribers")
    .select("telegram_chat_id")
    .eq("is_active", true);

  if (!subscribers || subscribers.length === 0) {
    return new Response(JSON.stringify({ error: "No Telegram subscribers found" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let text = body.message_body;
  if (body.cta_label && body.cta_url) {
    text += `\n\n<a href="${body.cta_url}">${body.cta_label}</a>`;
  }

  const { data: logData } = await adminClient.from("notification_send_log").insert({
    channel: "telegram",
    subject: body.subject,
    message_body: body.message_body.substring(0, 500),
    audience_count: subscribers.length,
    sent_count: 0,
    failed_count: 0,
    sent_by: userId,
    status: "sending",
  }).select("id").single();

  const logId = logData?.id;
  let sentCount = 0;
  let failedCount = 0;

  for (const sub of subscribers) {
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: sub.telegram_chat_id,
            text,
            parse_mode: "HTML",
          }),
        }
      );
      if (res.ok) sentCount++;
      else failedCount++;
    } catch {
      failedCount++;
    }
    await new Promise((r) => setTimeout(r, 50));
  }

  if (logId) {
    await adminClient
      .from("notification_send_log")
      .update({
        sent_count: sentCount,
        failed_count: failedCount,
        status: failedCount === 0 ? "completed" : sentCount > 0 ? "partial" : "failed",
      })
      .eq("id", logId);
  }

  return new Response(
    JSON.stringify({ success: true, sent_count: sentCount, failed_count: failedCount }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
