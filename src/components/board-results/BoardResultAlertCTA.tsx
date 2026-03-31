/**
 * Premium Alert Subscription CTA for Board Result pages.
 * Uses actual WhatsApp, Telegram, and Email logos.
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { z } from 'zod';

import { CTA_CHANNELS } from '@/lib/ctaConfig';

const emailSchema = z.string().trim().email('Please enter a valid email').max(255);

interface BoardResultAlertCTAProps {
  variant: 'strong' | 'compact';
  context: string;
  resultReleased?: boolean;
  className?: string;
}

export function BoardResultAlertCTA({
  variant = 'strong',
  context,
  resultReleased = false,
  className = '',
}: BoardResultAlertCTAProps) {
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const headline = resultReleased
    ? 'Get Updates for Revaluation & Marksheet'
    : 'Get Instant Alert When Result is Announced';

  const subtext = resultReleased
    ? 'Stay updated on revaluation, compartment exams, marksheet downloads, and related notices.'
    : `Be the first to know when ${context} results are declared. Join thousands of students.`;

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
        .insert({ email: result.data, frequency: 'instant', job_categories: ['board-results'] } as any);
      if (error) {
        if (error.code === '23505') {
          toast.info('You are already subscribed!');
          setIsSubmitted(true);
        } else throw error;
      } else {
        setIsSubmitted(true);
        toast.success('Subscribed! You\'ll receive instant result alerts.');
      }
    } catch (err) {
      console.error('Subscription error:', err);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
      setEmail('');
    }
  };

  if (variant === 'compact') {
    return (
      <div className={`rounded-xl border border-border/60 bg-card p-4 ${className}`}>
        <div className="flex items-center gap-2 mb-3">
          <Bell className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">{headline}</span>
        </div>
        <div className="flex gap-2 items-center">
          <AlertButton type="whatsapp" size="sm" />
          <AlertButton type="telegram" size="sm" />
          {!isSubmitted ? (
            <form onSubmit={handleEmailSubmit} className="flex gap-1.5 flex-1">
              <Input
                type="email" placeholder="Email" value={email}
                onChange={e => setEmail(e.target.value)}
                className="h-8 text-xs rounded-lg flex-1 min-w-0" required
              />
              <Button type="submit" disabled={isLoading} size="sm" className="h-8 text-xs rounded-lg px-3 bg-primary hover:bg-primary/90">
                {isLoading ? '…' : <img src={CTA_CHANNELS.email.logo} alt="Email" className="h-4 w-4 rounded-sm" />}
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

  const isStrong = variant === 'strong';

  return (
    <motion.div
      className={`rounded-2xl border ${isStrong ? 'border-primary/20 bg-gradient-to-br from-primary/[0.04] via-accent/[0.03] to-transparent' : 'border-border/50 bg-card'} p-6 md:p-8 ${className}`}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
    >
      <div className="flex flex-col items-center text-center gap-5">
        {/* Icon */}
        <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${isStrong ? 'bg-primary text-primary-foreground shadow-lg' : 'bg-muted text-primary'}`}>
          <Bell className="h-7 w-7" />
        </div>

        {/* Text */}
        <div className="max-w-md">
          <h3 className={`${isStrong ? 'text-xl' : 'text-lg'} font-bold text-foreground mb-1.5`}>
            {headline}
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{subtext}</p>
        </div>

        {/* Action buttons with real logos */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-md">
          <AlertButton type="whatsapp" size="default" />
          <AlertButton type="telegram" size="default" />
        </div>

        {/* Email form with real logo */}
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

        <p className="text-xs text-muted-foreground">
          Free • No spam • Unsubscribe anytime
        </p>
      </div>
    </motion.div>
  );
}

function AlertButton({ type, size = 'default' }: { type: 'whatsapp' | 'telegram'; size?: 'sm' | 'default' }) {
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

