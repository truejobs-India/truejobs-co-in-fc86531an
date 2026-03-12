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

    const { jobId, applicantId } = await req.json();
    if (!jobId || !applicantId) throw new Error("Missing jobId or applicantId");

    // Fetch job details
    const { data: job } = await supabase
      .from("jobs")
      .select("title, company_name, location, job_type, company_id")
      .eq("id", jobId)
      .maybeSingle();

    if (!job) throw new Error("Job not found");

    // Get company name from companies table if not on job directly
    let companyName = job.company_name || "the company";
    if (!job.company_name && job.company_id) {
      const { data: company } = await supabase
        .from("companies")
        .select("name")
        .eq("id", job.company_id)
        .maybeSingle();
      if (company) companyName = company.name;
    }

    // Fetch applicant details
    const { data: applicant } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("user_id", applicantId)
      .maybeSingle();

    if (!applicant?.email) {
      return new Response(
        JSON.stringify({ success: false, message: "Applicant email not found" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const candidateName = applicant.full_name || "there";
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
        to: [applicant.email],
        subject: `Application Confirmed: ${job.title} at ${companyName}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
          <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f4f7fa;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f7fa; padding: 40px 20px;">
              <tr><td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                  <tr>
                    <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
                      <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Application Submitted! ✅</h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 40px 30px;">
                      <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">Hi ${candidateName},</p>
                      <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
                        Your application has been successfully submitted. Here are the details:
                      </p>
                      
                      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0fdf4; border-radius: 8px; margin-bottom: 24px;">
                        <tr><td style="padding: 20px;">
                          <p style="color: #166534; font-size: 12px; text-transform: uppercase; margin: 0 0 8px; font-weight: 600;">Position Applied For</p>
                          <p style="color: #14532d; font-size: 18px; font-weight: 600; margin: 0 0 4px;">${job.title}</p>
                          <p style="color: #6b7280; font-size: 14px; margin: 0 0 4px;">🏢 ${companyName}</p>
                          ${job.location ? `<p style="color: #6b7280; font-size: 14px; margin: 0 0 4px;">📍 ${job.location}</p>` : ""}
                          ${job.job_type ? `<p style="color: #6b7280; font-size: 14px; margin: 0;">💼 ${jobTypeMap[job.job_type] || job.job_type}</p>` : ""}
                        </td></tr>
                      </table>

                      <p style="color: #374151; font-size: 14px; line-height: 1.6; margin: 0 0 8px;"><strong>What happens next?</strong></p>
                      <ul style="color: #6b7280; font-size: 14px; line-height: 1.8; padding-left: 20px; margin: 0 0 24px;">
                        <li>The employer will review your application</li>
                        <li>You'll be notified when there's an update</li>
                        <li>Track your application status from your dashboard</li>
                      </ul>

                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr><td align="center">
                          <a href="https://truejobs.co.in/dashboard" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                            Track Your Applications
                          </a>
                        </td></tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="background-color: #f9fafb; padding: 24px 30px; text-align: center; border-radius: 0 0 12px 12px;">
                      <p style="color: #9ca3af; font-size: 14px; margin: 0;">You're receiving this because you applied for a job on TrueJobs.</p>
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
    console.log("Application confirmation email sent:", emailData);

    return new Response(
      JSON.stringify({ success: true, emailResponse: emailData }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in notify-application-confirmation:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
