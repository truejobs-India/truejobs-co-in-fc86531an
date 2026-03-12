import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

interface NotifyRequest {
  jobId: string;
  applicantId: string;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY is not configured");
      return new Response(
        JSON.stringify({ success: false, message: "Email service not configured" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { jobId, applicantId }: NotifyRequest = await req.json();

    if (!jobId || !applicantId) {
      throw new Error("Missing jobId or applicantId");
    }

    // Fetch job details with company info
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id, title, company_id, company_name, posted_by")
      .eq("id", jobId)
      .maybeSingle();

    if (jobError || !job) {
      console.error("Failed to fetch job:", jobError);
      throw new Error("Job not found");
    }

    // Get employer's email - first try from posted_by, then from company owner
    let employerEmail: string | null = null;
    let employerName: string | null = null;

    if (job.posted_by) {
      const { data: employerProfile } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("user_id", job.posted_by)
        .maybeSingle();

      if (employerProfile) {
        employerEmail = employerProfile.email;
        employerName = employerProfile.full_name;
      }
    }

    // Fallback to company owner if posted_by doesn't have email
    if (!employerEmail && job.company_id) {
      const { data: company } = await supabase
        .from("companies")
        .select("owner_id")
        .eq("id", job.company_id)
        .maybeSingle();

      if (company?.owner_id) {
        const { data: ownerProfile } = await supabase
          .from("profiles")
          .select("email, full_name")
          .eq("user_id", company.owner_id)
          .maybeSingle();

        if (ownerProfile) {
          employerEmail = ownerProfile.email;
          employerName = ownerProfile.full_name;
        }
      }
    }

    if (!employerEmail) {
      console.log("No employer email found for job:", jobId);
      return new Response(
        JSON.stringify({ success: false, message: "No employer email found" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Fetch applicant details
    const { data: applicant } = await supabase
      .from("profiles")
      .select("full_name, email, headline, skills, experience_years")
      .eq("user_id", applicantId)
      .maybeSingle();

    const applicantName = applicant?.full_name || "A candidate";
    const applicantHeadline = applicant?.headline || "";
    const applicantExperience = applicant?.experience_years || 0;
    const applicantSkills = applicant?.skills?.slice(0, 5).join(", ") || "";

    // Send email notification using Resend REST API
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "TrueJobs <noreply@truejobs.co.in>",
        to: [employerEmail],
        subject: `New Application: ${applicantName} applied for ${job.title}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f4f7fa;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f7fa; padding: 40px 20px;">
              <tr>
                <td align="center">
                  <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <!-- Header -->
                    <tr>
                      <td style="background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
                        <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">New Job Application!</h1>
                      </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                      <td style="padding: 40px 30px;">
                        <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                          Hi ${employerName || "there"},
                        </p>
                        <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 30px;">
                          Great news! You have received a new application for your job posting.
                        </p>
                        
                        <!-- Job Details Card -->
                        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0f9ff; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                          <tr>
                            <td style="padding: 20px;">
                              <p style="color: #1e40af; font-size: 12px; text-transform: uppercase; margin: 0 0 8px; font-weight: 600;">Job Position</p>
                              <p style="color: #1e3a8a; font-size: 18px; font-weight: 600; margin: 0;">${job.title}</p>
                              ${job.company_name ? `<p style="color: #6b7280; font-size: 14px; margin: 8px 0 0;">${job.company_name}</p>` : ''}
                            </td>
                          </tr>
                        </table>
                        
                        <!-- Applicant Details Card -->
                        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 30px;">
                          <tr>
                            <td style="padding: 20px;">
                              <p style="color: #374151; font-size: 12px; text-transform: uppercase; margin: 0 0 12px; font-weight: 600;">Applicant Details</p>
                              <p style="color: #111827; font-size: 16px; font-weight: 600; margin: 0 0 4px;">${applicantName}</p>
                              ${applicantHeadline ? `<p style="color: #6b7280; font-size: 14px; margin: 0 0 12px;">${applicantHeadline}</p>` : ''}
                              ${applicantExperience > 0 ? `<p style="color: #6b7280; font-size: 14px; margin: 0 0 8px;">📊 Experience: ${applicantExperience} year${applicantExperience > 1 ? 's' : ''}</p>` : ''}
                              ${applicantSkills ? `<p style="color: #6b7280; font-size: 14px; margin: 0;">🎯 Skills: ${applicantSkills}</p>` : ''}
                            </td>
                          </tr>
                        </table>
                        
                        <!-- CTA Button -->
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td align="center">
                              <a href="https://truejobs.co.in/employer/dashboard" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                                View Application
                              </a>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                      <td style="background-color: #f9fafb; padding: 24px 30px; text-align: center; border-radius: 0 0 12px 12px;">
                        <p style="color: #9ca3af; font-size: 14px; margin: 0;">
                          This email was sent by TrueJobs. You're receiving this because you posted a job on our platform.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `,
      }),
    });

    const emailData = await emailResponse.json();
    console.log("Email sent successfully:", emailData);

    // Also create an in-app notification for the employer
    if (job.posted_by) {
      await supabase.from("notifications").insert({
        user_id: job.posted_by,
        title: "New Application Received",
        message: `${applicantName} applied for ${job.title}`,
        type: "application",
        link: "/employer/dashboard",
      });
    }

    return new Response(
      JSON.stringify({ success: true, emailResponse: emailData }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in notify-employer-application:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
