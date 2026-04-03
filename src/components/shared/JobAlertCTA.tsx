/**
 * Shared Job Alert CTA — single component for the entire site.
 * Variants: strong (detail pages), compact (sidebars/listings), banner (horizontal strips).
 * All URLs from ctaConfig.ts. Email = direct email_subscribers insert, never /signup.
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { z } from 'zod';
import { CTA_CHANNELS, CTA_TRUST_LINE } from '@/lib/ctaConfig';

const emailSchema = z.string().trim().email('Please enter a valid email').max(255);

interface JobAlertCTAProps {
  variant: 'strong' | 'compact' | 'banner';
  context?: string;
  className?: string;
}

export function JobAlertCTA({ variant, context, className = '' }: JobAlertCTAProps) {
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const headline = context
    ? `Get Instant Alerts for ${context}`
    : 'Get Free Job Alerts';

  const subtext = context
    ? `Be the first to know about ${context} updates. Join thousands of aspirants.`
    : 'Join WhatsApp, Telegram, or email alerts for daily government job updates.';

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = emailSchema.safeParse(email);
    if (!result.success) {
      toast.error(result.error.errors[0].message);
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('email_subscribers' as any)
        .insert({ email: result.data, frequency: 'daily' } as any);
      if (error) {
        if (error.code === '23505') {
          toast.info('You are already subscribed!');
          setIsSubmitted(true);
        } else throw error;
      } else {
        setIsSubmitted(true);
        toast.success('Subscribed! You\'ll receive job alerts via email.');
      }
    } catch (err) {
      console.error('Subscription error:', err);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
      setEmail('');
    }
  };

  // ── Compact ────────────────────────────────────────────────
  if (variant === 'compact') {
    return (
      <div className={`rounded-xl border border-border/60 bg-card p-4 ${className}`}>
        <div className="flex items-center gap-2 mb-3">
          <Bell className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">{headline}</span>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <ChannelButton type="whatsapp" size="sm" />
          <ChannelButton type="telegram" size="sm" />
          {!isSubmitted ? (
            <form onSubmit={handleEmailSubmit} className="flex gap-1.5 flex-1 min-w-[180px]">
              <Input
                type="email" placeholder="Email" value={email}
                onChange={e => setEmail(e.target.value)}
                className="h-8 text-xs rounded-lg flex-1 min-w-0" required
              />
              <Button type="submit" disabled={isLoading} size="sm" className="h-8 text-xs rounded-lg px-3 bg-primary hover:bg-primary/90">
                {isLoading ? '…' : <img src={CTA_CHANNELS.email.logo} alt="Email" className="h-4 w-4 rounded-sm" width={16} height={16} />}
              </Button>
            </form>
          ) : (
            <span className="flex items-center gap-1 text-xs text-primary font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" /> Subscribed
            </span>
          )}
        </div>
      </div>
    );
  }

  // ── Banner ─────────────────────────────────────────────────
  if (variant === 'banner') {
    return (
      <motion.div
        className={`rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 p-5 ${className}`}
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
      >
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{headline}</p>
              <p className="text-xs text-muted-foreground">Daily updates on WhatsApp, Telegram & Email</p>
            </div>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <ChannelButton type="whatsapp" size="sm" />
            <ChannelButton type="telegram" size="sm" />
            {!isSubmitted ? (
              <form onSubmit={handleEmailSubmit} className="flex gap-1.5">
                <Input
                  type="email" placeholder="your@email.com" value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="h-8 rounded-lg w-40 text-xs" required
                />
                <Button type="submit" disabled={isLoading} size="sm" className="h-8 text-xs rounded-lg bg-primary hover:bg-primary/90">
                  {isLoading ? '…' : 'Subscribe'}
                </Button>
              </form>
            ) : (
              <span className="flex items-center gap-1 text-xs text-primary font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" /> Subscribed
              </span>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  // ── Strong (default) ───────────────────────────────────────
  return (
    <motion.div
      className={`rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.04] via-accent/[0.03] to-transparent p-6 md:p-8 ${className}`}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
    >
      <div className="flex flex-col items-center text-center gap-5">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
          <Bell className="h-7 w-7" />
        </div>

        <div className="max-w-md">
          <h3 className="text-xl font-bold text-foreground mb-1.5">{headline}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{subtext}</p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-md">
          <ChannelButton type="whatsapp" size="default" />
          <ChannelButton type="telegram" size="default" />
        </div>

        <div className="w-full max-w-md">
          {isSubmitted ? (
            <div className="flex items-center justify-center gap-2 text-primary font-semibold py-2">
              <CheckCircle2 className="h-5 w-5" /> You're subscribed to email alerts!
            </div>
          ) : (
            <form onSubmit={handleEmailSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <img src={CTA_CHANNELS.email.logo} alt="" className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 rounded-sm" />
                <Input
                  type="email" placeholder="Enter your email for alerts"
                  value={email} onChange={e => setEmail(e.target.value)}
                  className="pl-10 h-11 rounded-xl" required
                />
              </div>
              <Button type="submit" disabled={isLoading} className="h-11 rounded-xl px-5 bg-primary hover:bg-primary/90">
                {isLoading ? 'Subscribing…' : 'Subscribe'}
              </Button>
            </form>
          )}
        </div>

        <p className="text-xs text-muted-foreground">{CTA_TRUST_LINE}</p>
      </div>
    </motion.div>
  );
}

function ChannelButton({ type, size = 'default' }: { type: 'whatsapp' | 'telegram'; size?: 'sm' | 'default' }) {
  const c = CTA_CHANNELS[type];
  const imgSize = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  const h = size === 'sm' ? 'h-8 text-xs px-3' : 'h-10 text-sm px-4';

  return (
    <Button asChild className={`${c.bgClass} text-white rounded-xl ${h} flex-1`}>
      <a href={c.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
        <img src={c.logo} alt={type} className={`${imgSize} rounded-sm object-cover`} />
        <span>{c.label}</span>
      </a>
    </Button>
  );
}
