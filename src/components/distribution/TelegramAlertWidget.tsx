import { motion } from 'framer-motion';
import { Send, Users, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect } from 'react';

export function TelegramAlertWidget({ compact = false }: { compact?: boolean }) {
  const [telegramUrl, setTelegramUrl] = useState('https://t.me/truejobs_alerts');

  useEffect(() => {
    // Load configurable Telegram URL from app_settings
    supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'telegram_channel_url')
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value && typeof data.value === 'string') {
          setTelegramUrl(data.value);
        }
      });
  }, []);

  if (compact) {
    return (
      <a
        href={telegramUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex items-center gap-3 rounded-xl border border-border/50 bg-card p-4 hover:border-primary/30 hover:shadow-md transition-all"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[hsl(200_100%_40%)] text-white">
          <Send className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Join Telegram Alerts</p>
          <p className="text-xs text-muted-foreground">Instant job notifications</p>
        </div>
        <Zap className="h-4 w-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
      </a>
    );
  }

  return (
    <motion.div
      className="relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br from-[hsl(200_100%_40%/0.05)] to-[hsl(200_100%_40%/0.12)] p-6"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
    >
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-[hsl(200_100%_40%/0.1)] blur-2xl" />

      <div className="relative z-10 flex flex-col items-center text-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[hsl(200_100%_40%)] text-white shadow-lg">
          <Send className="h-7 w-7" />
        </div>

        <div>
          <h3 className="text-lg font-bold text-foreground mb-1">
            Get Jobs on Telegram
          </h3>
          <p className="text-sm text-muted-foreground">
            Join our channel for instant job alerts. Never miss an opportunity.
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Zap className="h-3.5 w-3.5 text-primary" /> Instant alerts
          </span>
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5 text-primary" /> Free forever
          </span>
        </div>

        <Button
          asChild
          className="w-full bg-[hsl(200_100%_40%)] hover:bg-[hsl(200_100%_35%)] text-white rounded-xl"
        >
          <a href={telegramUrl} target="_blank" rel="noopener noreferrer">
            <Send className="mr-2 h-4 w-4" />
            Join Telegram Channel
          </a>
        </Button>
      </div>
    </motion.div>
  );
}
