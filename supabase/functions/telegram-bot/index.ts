import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { action } = body;

    // Action: subscribe — register a new Telegram subscriber
    if (action === 'subscribe') {
      const { telegram_chat_id, telegram_username, categories, states, qualifications } = body;

      if (!telegram_chat_id) {
        return new Response(JSON.stringify({ error: 'telegram_chat_id required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error } = await supabase
        .from('telegram_subscribers')
        .upsert({
          telegram_chat_id: String(telegram_chat_id),
          telegram_username: telegram_username || null,
          categories: categories || [],
          states: states || [],
          qualifications: qualifications || [],
          is_active: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'telegram_chat_id' });

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true, message: 'Subscribed successfully' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: unsubscribe
    if (action === 'unsubscribe') {
      const { telegram_chat_id } = body;
      await supabase
        .from('telegram_subscribers')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('telegram_chat_id', String(telegram_chat_id));

      return new Response(JSON.stringify({ success: true, message: 'Unsubscribed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: broadcast — send alerts to matching subscribers (called by cron/admin)
    if (action === 'broadcast') {
      const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
      if (!TELEGRAM_BOT_TOKEN) {
        return new Response(JSON.stringify({ error: 'TELEGRAM_BOT_TOKEN not configured' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { message, category, state } = body;

      // Fetch matching active subscribers
      let query = supabase
        .from('telegram_subscribers')
        .select('telegram_chat_id, categories, states')
        .eq('is_active', true);

      const { data: subscribers } = await query;
      if (!subscribers || subscribers.length === 0) {
        return new Response(JSON.stringify({ success: true, sent: 0 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Filter subscribers by preference match
      const matched = subscribers.filter((sub: any) => {
        const catMatch = !category || sub.categories.length === 0 || sub.categories.includes(category);
        const stateMatch = !state || sub.states.length === 0 || sub.states.includes(state);
        return catMatch && stateMatch;
      });

      // Send messages (rate-limited: max 30/sec for Telegram API)
      let sent = 0;
      for (const sub of matched) {
        try {
          await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: sub.telegram_chat_id,
              text: message,
              parse_mode: 'HTML',
              disable_web_page_preview: false,
            }),
          });
          sent++;
          // Simple rate limit: ~25 messages per second
          if (sent % 25 === 0) {
            await new Promise(resolve => setTimeout(resolve, 1100));
          }
        } catch (err) {
          console.error(`Failed to send to ${sub.telegram_chat_id}:`, err);
        }
      }

      return new Response(JSON.stringify({ success: true, sent, total: matched.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: stats — get subscriber count
    if (action === 'stats') {
      const { count } = await supabase
        .from('telegram_subscribers')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      return new Response(JSON.stringify({ active_subscribers: count || 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
