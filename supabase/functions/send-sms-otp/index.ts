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
  action: z.enum(['send', 'verify']),
  otp: z.string().length(6).regex(/^\d+$/, "OTP must be 6 digits").optional(),
  purpose: z.enum(['signup', 'reset_password', 'login']),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('TWOFACTOR_API_KEY');
    if (!apiKey) {
      throw new Error('2Factor API key not configured');
    }

    // Parse and validate request body
    const rawBody = await req.json();
    const parseResult = requestSchema.safeParse(rawBody);
    
    if (!parseResult.success) {
      return new Response(
        JSON.stringify({ success: false, error: parseResult.error.errors[0].message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { phone, action, otp, purpose } = parseResult.data;

    // Clean phone number - remove spaces and ensure format
    const cleanPhone = phone.replace(/\s+/g, '').replace(/^\+/, '');

    // Validate phone number format more strictly
    if (!/^\d{10,15}$/.test(cleanPhone)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid phone number format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'send') {
      // Send OTP using 2factor.in API
      const response = await fetch(
        `https://2factor.in/API/V1/${apiKey}/SMS/${encodeURIComponent(cleanPhone)}/AUTOGEN`,
        { method: 'GET' }
      );

      const result = await response.json();

      if (result.Status !== 'Success') {
        throw new Error(result.Details || 'Failed to send OTP');
      }

      // Store the session ID for verification
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Store OTP session in database
      const { error: insertError } = await supabase
        .from('otp_sessions')
        .upsert({
          phone: cleanPhone,
          session_id: result.Details,
          purpose,
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 min expiry
        }, { onConflict: 'phone' });

      if (insertError) {
        console.error('Error storing OTP session:', insertError);
        throw new Error('Failed to initialize OTP session');
      }

      return new Response(
        JSON.stringify({ success: true, message: 'OTP sent successfully' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else if (action === 'verify') {
      if (!otp) {
        return new Response(
          JSON.stringify({ success: false, error: 'OTP is required for verification' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get session ID from database
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const { data: session, error: sessionError } = await supabase
        .from('otp_sessions')
        .select('*')
        .eq('phone', cleanPhone)
        .single();

      if (sessionError || !session) {
        return new Response(
          JSON.stringify({ success: false, error: 'OTP session not found. Please request a new OTP.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (new Date(session.expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ success: false, error: 'OTP has expired. Please request a new one.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify OTP using 2factor.in API
      const response = await fetch(
        `https://2factor.in/API/V1/${apiKey}/SMS/VERIFY/${encodeURIComponent(session.session_id)}/${encodeURIComponent(otp)}`,
        { method: 'GET' }
      );

      const result = await response.json();

      if (result.Status !== 'Success') {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid OTP' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Mark session as verified
      await supabase
        .from('otp_sessions')
        .update({ verified: true })
        .eq('phone', cleanPhone);

      return new Response(
        JSON.stringify({ success: true, verified: true, purpose: session.purpose }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('SMS OTP Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});