import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

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

    const { email, fullName, companyName } = await req.json();
    if (!email) throw new Error("Missing email");

    const name = fullName || "there";
    const company = companyName || "your company";

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "TrueJobs <noreply@truejobs.co.in>",
        to: [email],
        subject: `Welcome to TrueJobs, ${name}! Start Hiring Today`,
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
                      <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Welcome to TrueJobs! 🏢</h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 40px 30px;">
                      <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">Hi ${name},</p>
                      <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                        Welcome aboard! Your employer account on <strong>TrueJobs</strong> is ready. You can now post jobs and connect with thousands of qualified candidates across India.
                      </p>
                      
                      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                        <tr><td style="padding: 12px 16px; background-color: #eff6ff; border-radius: 8px;">
                          <p style="margin: 0; color: #1e40af; font-size: 14px;">🏢 <strong>Set up your company profile</strong> — Add logo, description & contact info</p>
                        </td></tr>
                        <tr><td style="height: 8px;"></td></tr>
                        <tr><td style="padding: 12px 16px; background-color: #eff6ff; border-radius: 8px;">
                          <p style="margin: 0; color: #1e40af; font-size: 14px;">📝 <strong>Post your first job</strong> — Reach thousands of active job seekers</p>
                        </td></tr>
                        <tr><td style="height: 8px;"></td></tr>
                        <tr><td style="padding: 12px 16px; background-color: #eff6ff; border-radius: 8px;">
                          <p style="margin: 0; color: #1e40af; font-size: 14px;">📊 <strong>Track applications</strong> — Manage candidates from your dashboard</p>
                        </td></tr>
                      </table>

                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr><td align="center">
                          <a href="https://truejobs.co.in/employer/dashboard" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                            Go to Employer Dashboard
                          </a>
                        </td></tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="background-color: #f9fafb; padding: 24px 30px; text-align: center; border-radius: 0 0 12px 12px;">
                      <p style="color: #9ca3af; font-size: 14px; margin: 0;">You're receiving this because you registered as an employer on TrueJobs.</p>
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
    console.log("Welcome employer email sent:", emailData);

    return new Response(
      JSON.stringify({ success: true, emailResponse: emailData }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in welcome-employer:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
