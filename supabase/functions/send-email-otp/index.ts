import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SendOTPRequest {
  email: string;
  purpose?: string;
}

interface VerifyOTPRequest {
  email: string;
  otp: string;
}

// Generate a 6-digit OTP
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const action = url.pathname.split('/').pop();

    if (action === "send") {
      const { email, purpose = "login" }: SendOTPRequest = await req.json();

      if (!email) {
        return new Response(
          JSON.stringify({ error: "Email is required" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const otp = generateOTP();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      // Delete any existing OTP sessions for this email
      await supabase
        .from("email_otp_sessions")
        .delete()
        .eq("email", email.toLowerCase())
        .eq("purpose", purpose);

      // Insert new OTP session
      const { error: insertError } = await supabase
        .from("email_otp_sessions")
        .insert({
          email: email.toLowerCase(),
          otp_code: otp,
          purpose,
          expires_at: expiresAt.toISOString(),
        });

      if (insertError) {
        console.error("Failed to create OTP session:", insertError);
        return new Response(
          JSON.stringify({ error: "Failed to create OTP session" }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Send OTP email using Resend
      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "TrueJobs <noreply@truejobs.co.in>",
          to: [email],
          subject: "Your TrueJobs Login Code",
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px;">
              <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <div style="text-align: center; margin-bottom: 32px;">
                  <h1 style="color: #1a1a1a; font-size: 24px; font-weight: 600; margin: 0;">TrueJobs</h1>
                </div>
                
                <h2 style="color: #1a1a1a; font-size: 20px; font-weight: 600; margin-bottom: 16px; text-align: center;">Your Login Code</h2>
                
                <p style="color: #666; font-size: 16px; line-height: 24px; margin-bottom: 24px; text-align: center;">
                  Enter this code to sign in to your TrueJobs account:
                </p>
                
                <div style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); border-radius: 8px; padding: 24px; text-align: center; margin-bottom: 24px;">
                  <span style="font-size: 42px; font-weight: 700; letter-spacing: 12px; color: white;">${otp}</span>
                </div>
                
                <p style="color: #999; font-size: 14px; text-align: center; margin-bottom: 8px;">
                  This code will expire in <strong>10 minutes</strong>
                </p>
                
                <p style="color: #999; font-size: 12px; text-align: center; margin-top: 32px;">
                  If you didn't request this code, you can safely ignore this email.
                </p>
              </div>
            </body>
            </html>
          `,
        }),
      });

      if (!emailResponse.ok) {
        const errorData = await emailResponse.text();
        console.error("Failed to send email:", errorData);
        return new Response(
          JSON.stringify({ error: "Failed to send verification email" }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      console.log("Email OTP sent successfully to:", email);

      return new Response(
        JSON.stringify({ success: true, message: "OTP sent successfully" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );

    } else if (action === "verify") {
      const { email, otp }: VerifyOTPRequest = await req.json();

      if (!email || !otp) {
        return new Response(
          JSON.stringify({ error: "Email and OTP are required" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Find the OTP session
      const { data: session, error: fetchError } = await supabase
        .from("email_otp_sessions")
        .select("*")
        .eq("email", email.toLowerCase())
        .eq("otp_code", otp)
        .eq("verified", false)
        .gt("expires_at", new Date().toISOString())
        .single();

      if (fetchError || !session) {
        return new Response(
          JSON.stringify({ error: "Invalid or expired OTP" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Mark as verified
      await supabase
        .from("email_otp_sessions")
        .update({ verified: true })
        .eq("id", session.id);

      // Check if user exists in auth
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(
        (u) => u.email?.toLowerCase() === email.toLowerCase()
      );

      let userId: string;

      if (existingUser) {
        userId = existingUser.id;
      } else {
        // Create new user with confirmed email
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
          email: email.toLowerCase(),
          email_confirm: true,
          user_metadata: { full_name: '' },
        });

        if (createError || !newUser.user) {
          console.error("Failed to create user:", createError);
          return new Response(
            JSON.stringify({ error: "Failed to create user account" }),
            { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        userId = newUser.user.id;
      }

      // Generate a magic link and verify it server-side to get session tokens
      const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: "magiclink",
        email: email.toLowerCase(),
      });

      if (linkError || !linkData) {
        console.error("Failed to generate auth link:", linkError);
        return new Response(
          JSON.stringify({ error: "Failed to generate session" }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Extract token from the action link and verify server-side
      const actionLink = linkData.properties?.action_link;
      if (!actionLink) {
        console.error("No action link in generateLink response");
        return new Response(
          JSON.stringify({ error: "Failed to generate session" }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Call the verify endpoint server-side to exchange token for session
      const verifyUrl = new URL(actionLink);
      const token = verifyUrl.searchParams.get("token");
      const type = verifyUrl.searchParams.get("type") || "magiclink";

      const verifyResponse = await fetch(
        `${supabaseUrl}/auth/v1/verify`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": Deno.env.get("SUPABASE_ANON_KEY") || supabaseServiceKey,
          },
          body: JSON.stringify({
            token_hash: linkData.properties?.hashed_token,
            type,
          }),
        }
      );

      if (!verifyResponse.ok) {
        const errText = await verifyResponse.text();
        console.error("Server-side token verify failed:", errText);
        return new Response(
          JSON.stringify({ error: "Failed to establish session" }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const sessionData = await verifyResponse.json();
      const isNewUser = !existingUser;

      // Fetch user roles
      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      const roles = rolesData?.map((r) => r.role) || [];

      return new Response(
        JSON.stringify({
          success: true,
          verified: true,
          access_token: sessionData.access_token,
          refresh_token: sessionData.refresh_token,
          is_new_user: isNewUser,
          roles,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );

    } else {
      return new Response(
        JSON.stringify({ error: "Invalid action. Use /send or /verify" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

  } catch (error: any) {
    console.error("Error in send-email-otp function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
