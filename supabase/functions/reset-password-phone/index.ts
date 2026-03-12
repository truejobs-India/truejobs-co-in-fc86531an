import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema
const requestSchema = z.object({
  phone: z.string()
    .min(10, "Phone number must be at least 10 digits")
    .max(15, "Phone number too long")
    .regex(/^[\d\s+]+$/, "Phone number can only contain digits, spaces, and +"),
  newPassword: z.string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password too long"),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse and validate request body
    const rawBody = await req.json();
    const parseResult = requestSchema.safeParse(rawBody);
    
    if (!parseResult.success) {
      return new Response(
        JSON.stringify({ success: false, error: parseResult.error.errors[0].message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { phone, newPassword } = parseResult.data;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Clean phone number - remove spaces and leading +
    const cleanPhone = phone.replace(/\s+/g, '').replace(/^\+/, '');

    // Verify the OTP session was completed
    const { data: session, error: sessionError } = await supabase
      .from('otp_sessions')
      .select('*')
      .eq('phone', cleanPhone)
      .eq('purpose', 'reset_password')
      .eq('verified', true)
      .single();

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ success: false, error: 'Phone verification required before password reset' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if session is still valid (within 10 minutes of verification)
    const sessionTime = new Date(session.created_at).getTime();
    const now = Date.now();
    if (now - sessionTime > 10 * 60 * 1000) {
      return new Response(
        JSON.stringify({ success: false, error: 'Session expired. Please verify your phone again.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find user by phone in profiles
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('phone', phone)
      .single();

    if (profileError || !profile) {
      // Try with the SMS email pattern
      const phoneEmail = `${cleanPhone}@sms.local`;
      
      const { data: userData, error: userError } = await supabase.auth.admin.listUsers();
      
      if (userError) throw userError;

      const user = userData.users.find(u => u.email === phoneEmail);
      
      if (!user) {
        return new Response(
          JSON.stringify({ success: false, error: 'No account found with this phone number' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update the user's password
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        user.id,
        { password: newPassword }
      );

      if (updateError) throw updateError;
    } else {
      // Update the user's password using the profile user_id
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        profile.user_id,
        { password: newPassword }
      );

      if (updateError) throw updateError;
    }

    // Clean up the OTP session
    await supabase
      .from('otp_sessions')
      .delete()
      .eq('phone', cleanPhone);

    return new Response(
      JSON.stringify({ success: true, message: 'Password reset successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Password reset error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});