import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, message: "Email service not configured" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { jobTitle, jobLocation, jobType, companyName, employerId, status } = await req.json();
    if (!employerId || !jobTitle) throw new Error("Missing required fields");

    // Fetch employer email
    const { data: employer } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("user_id", employerId)
      .maybeSingle();

    if (!employer?.email) {
      return new Response(
        JSON.stringify({ success: false, message: "Employer email not found" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const employerName = employer.full_name || "there";
    const jobStatus = status === "active" ? "live and visible to candidates" : "submitted and pending admin approval";
    const statusColor = status === "active" ? "#10b981" : "#f59e0b";
    const statusLabel = status === "active" ? "🟢 Live" : "🟡 Pending Approval";

    const jobTypeMap: Record<string, string> = {
      full_time: "Full Time", part_time: "Part Time", contract: "Contract",
      internship: "Internship", remote: "Remote",
    };

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "TrueJobs <noreply@truejobs.co.in>",
        to: [employer.email],
        subject: `Job Posted: ${jobTitle} – ${statusLabel}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
          <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f4f7fa;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f7fa; padding: 40px 20px;">
              <tr><td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                  <tr>
                    <td style="background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
                      <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Job Successfully Posted! 📋</h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 40px 30px;">
                      <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">Hi ${employerName},</p>
                      <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
                        Your job posting is now ${jobStatus}. Here are the details:
                      </p>
                      
                      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #eff6ff; border-radius: 8px; margin-bottom: 24px;">
                        <tr><td style="padding: 20px;">
                          <p style="color: #1e40af; font-size: 12px; text-transform: uppercase; margin: 0 0 8px; font-weight: 600;">Job Details</p>
                          <p style="color: #1e3a8a; font-size: 18px; font-weight: 600; margin: 0 0 4px;">${jobTitle}</p>
                          ${companyName ? `<p style="color: #6b7280; font-size: 14px; margin: 0 0 4px;">🏢 ${companyName}</p>` : ""}
                          ${jobLocation ? `<p style="color: #6b7280; font-size: 14px; margin: 0 0 4px;">📍 ${jobLocation}</p>` : ""}
                          ${jobType ? `<p style="color: #6b7280; font-size: 14px; margin: 0 0 8px;">💼 ${jobTypeMap[jobType] || jobType}</p>` : ""}
                          <p style="color: ${statusColor}; font-size: 14px; font-weight: 600; margin: 0;">${statusLabel}</p>
                        </td></tr>
                      </table>

                      ${status === "active" ? `
                      <p style="color: #374151; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
                        Candidates can now find and apply to your job listing. You'll receive an email notification for each new application.
                      </p>
                      ` : `
                      <p style="color: #374151; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
                        Your job is currently under review by our team. Once approved, it will go live and candidates will be able to apply. We'll notify you once it's approved.
                      </p>
                      `}

                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr><td align="center">
                          <a href="https://truejobs.co.in/employer/dashboard" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                            View Employer Dashboard
                          </a>
                        </td></tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="background-color: #f9fafb; padding: 24px 30px; text-align: center; border-radius: 0 0 12px 12px;">
                      <p style="color: #9ca3af; font-size: 14px; margin: 0;">You're receiving this because you posted a job on TrueJobs.</p>
                    </td>
                  </tr>
                </table>
              </td></tr>
            </table>
          </body>
          </html>
        `,
      }),
    });

    const emailData = await emailResponse.json();
    console.log("Job posted notification sent:", emailData);

    return new Response(
      JSON.stringify({ success: true, emailResponse: emailData }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in notify-job-posted:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
