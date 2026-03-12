import { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, CheckCircle2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { z } from 'zod';

const emailSchema = z.string().trim().email('Please enter a valid email').max(255);

interface EmailDigestCaptureProps {
  variant?: 'inline' | 'card' | 'banner';
  className?: string;
}

export function EmailDigestCapture({ variant = 'card', className = '' }: EmailDigestCaptureProps) {
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
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
        } else {
          throw error;
        }
      } else {
        setIsSubmitted(true);
        toast.success('Subscribed! You\'ll receive daily job alerts.');
      }
    } catch (err) {
      console.error('Subscription error:', err);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
      setEmail('');
    }
  };

  if (variant === 'inline') {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        {isSubmitted ? (
          <div className="flex items-center gap-2 text-sm text-primary font-medium">
            <CheckCircle2 className="h-4 w-4" />
            Subscribed to daily digest!
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex gap-2 w-full max-w-md">
            <div className="relative flex-1">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="email"
                placeholder="Your email for daily jobs"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-9 h-10 rounded-xl"
                required
              />
            </div>
            <Button type="submit" disabled={isLoading} size="sm" className="rounded-xl bg-gradient-primary hover:opacity-90">
              {isLoading ? '...' : 'Subscribe'}
            </Button>
          </form>
        )}
      </div>
    );
  }

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
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Daily Job Digest</p>
              <p className="text-xs text-muted-foreground">Top jobs delivered to your inbox every morning</p>
            </div>
          </div>
          {isSubmitted ? (
            <div className="flex items-center gap-2 text-sm text-primary font-medium">
              <CheckCircle2 className="h-4 w-4" />
              Subscribed!
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex gap-2 w-full sm:w-auto">
              <Input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-10 rounded-xl w-48"
                required
              />
              <Button type="submit" disabled={isLoading} size="sm" className="rounded-xl bg-gradient-primary hover:opacity-90">
                {isLoading ? '...' : 'Subscribe'}
              </Button>
            </form>
          )}
        </div>
      </motion.div>
    );
  }

  // Default: card variant
  return (
    <motion.div
      className={`rounded-2xl border border-border/50 bg-card p-6 shadow-sm ${className}`}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
    >
      <div className="flex flex-col items-center text-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
          <Sparkles className="h-7 w-7" />
        </div>

        <div>
          <h3 className="text-lg font-bold text-foreground mb-1">Daily Job Digest</h3>
          <p className="text-sm text-muted-foreground">
            Get the best jobs delivered to your inbox every morning. No spam, unsubscribe anytime.
          </p>
        </div>

        {isSubmitted ? (
          <div className="flex items-center gap-2 text-primary font-semibold">
            <CheckCircle2 className="h-5 w-5" />
            You're subscribed!
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="w-full space-y-3">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-9 h-11 rounded-xl"
                required
              />
            </div>
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-xl bg-gradient-primary hover:opacity-90"
            >
              {isLoading ? 'Subscribing...' : 'Subscribe to Daily Digest'}
            </Button>
          </form>
        )}

        <p className="text-xs text-muted-foreground">
          Join 10,000+ job seekers • Free forever
        </p>
      </div>
    </motion.div>
  );
}
