import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get applications with follow-up dates within the next 24 hours that haven't been notified
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const today = new Date();

    const { data: applications, error: fetchError } = await supabase
      .from("applications")
      .select(`
        id,
        follow_up_date,
        reminder_sent,
        applicant_id,
        job:jobs(
          id,
          title,
          company:companies(name)
        )
      `)
      .gte("follow_up_date", today.toISOString())
      .lte("follow_up_date", tomorrow.toISOString())
      .eq("reminder_sent", false);

    if (fetchError) {
      console.error("Error fetching applications:", fetchError);
      throw fetchError;
    }

    console.log(`Found ${applications?.length || 0} applications with upcoming reminders`);

    const results = {
      sent: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const app of applications || []) {
      // Get user email from profile
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("user_id", app.applicant_id)
        .single();

      if (profileError || !profile?.email) {
        console.error(`Could not find email for user ${app.applicant_id}`);
        results.failed++;
        results.errors.push(`No email for user ${app.applicant_id}`);
        continue;
      }

      const jobTitle = (app.job as any)?.title || "Unknown Position";
      const companyName = (app.job as any)?.company?.name || "Unknown Company";
      const followUpDate = new Date(app.follow_up_date).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      try {
        // Send email using Resend REST API
        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "TrueJobs <notifications@resend.dev>",
            to: [profile.email],
            subject: `Follow-up Reminder: ${jobTitle} at ${companyName}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h1 style="color: #6366f1;">Follow-up Reminder</h1>
                <p>Hi ${profile.full_name || "there"},</p>
                <p>This is a friendly reminder about your scheduled follow-up for:</p>
                <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <h2 style="margin: 0 0 10px 0; color: #1f2937;">${jobTitle}</h2>
                  <p style="margin: 0; color: #6b7280;">${companyName}</p>
                </div>
                <p><strong>Scheduled for:</strong> ${followUpDate}</p>
                <p>Don't forget to reach out and check on your application status!</p>
                <div style="margin-top: 30px;">
                  <a href="https://truejobs.co.in/dashboard" 
                     style="background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
                    View Your Applications
                  </a>
                </div>
                <p style="margin-top: 40px; color: #9ca3af; font-size: 14px;">
                  Good luck with your job search!<br>
                  The TrueJobs Team
                </p>
              </div>
            `,
          }),
        });

        if (!emailResponse.ok) {
          const errorData = await emailResponse.json();
          throw new Error(errorData.message || "Failed to send email");
        }

        // Mark reminder as sent
        await supabase
          .from("applications")
          .update({ reminder_sent: true })
          .eq("id", app.id);

        results.sent++;
        console.log(`Sent reminder email to ${profile.email} for job ${jobTitle}`);
      } catch (emailError: any) {
        console.error(`Failed to send email to ${profile.email}:`, emailError);
        results.failed++;
        results.errors.push(`Email to ${profile.email} failed: ${emailError.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${applications?.length || 0} reminders`,
        results,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-reminder-emails:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
