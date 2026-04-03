import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CTA_CHANNELS } from '@/lib/ctaConfig';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { z } from 'zod';

const emailSchema = z.string().trim().email('Please enter a valid email').max(255);

export function HeroSideCards() {
  return (
    <div className="grid gap-4 h-full">
      {/* Results & Admit Cards card */}
      <div className="bg-card rounded-2xl p-5 border border-border" style={{ boxShadow: '0 8px 24px hsla(217, 33%, 17%, 0.06)' }}>
        <span className="inline-block bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-medium mb-3">
          Quick updates
        </span>
        <h3 className="text-lg font-bold text-foreground mb-2 font-['Outfit',sans-serif]">Results & Admit Cards</h3>
        <p className="text-muted-foreground text-sm mb-3 leading-relaxed">
          Check the latest exam results, hall tickets, answer keys, and important date updates.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link to="/sarkari-jobs?status=result_declared" className="px-3 py-1.5 rounded-full bg-primary/5 text-foreground text-xs font-medium hover:bg-primary/10 transition-colors">
            Sarkari Results
          </Link>
          <Link to="/sarkari-jobs?status=admit_card_released" className="px-3 py-1.5 rounded-full bg-primary/5 text-foreground text-xs font-medium hover:bg-primary/10 transition-colors">
            Admit Cards
          </Link>
          <Link to="/sarkari-jobs" className="px-3 py-1.5 rounded-full bg-primary/5 text-foreground text-xs font-medium hover:bg-primary/10 transition-colors">
            Answer Keys
          </Link>
          <Link to="/sarkari-jobs" className="px-3 py-1.5 rounded-full bg-primary/5 text-foreground text-xs font-medium hover:bg-primary/10 transition-colors">
            Exam Dates
          </Link>
        </div>
      </div>

      {/* Get Free Job Alerts card */}
      <div className="bg-amber-500 rounded-2xl p-5 text-foreground" style={{ boxShadow: '0 8px 24px hsla(38, 92%, 50%, 0.2)' }}>
        <h3 className="text-lg font-bold mb-2 font-['Outfit',sans-serif] text-gray-900">Get Free Job Alerts</h3>
        <p className="text-gray-800 text-sm mb-4 leading-relaxed">
          Join WhatsApp, Telegram, or email alerts for daily government job updates.
        </p>
        <div className="flex flex-wrap gap-2">
          <a
            href={CTA_CHANNELS.whatsapp.url}
            target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[hsl(142_70%_40%)] text-white text-xs font-semibold hover:bg-[hsl(142_70%_35%)] transition-colors"
          >
            <img src={CTA_CHANNELS.whatsapp.logo} alt="WhatsApp" className="h-3.5 w-3.5 rounded-sm" width={14} height={14} /> WhatsApp Alerts
          </a>
          <a
            href={CTA_CHANNELS.telegram.url}
            target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[hsl(200_100%_40%)] text-white text-xs font-semibold hover:bg-[hsl(200_100%_35%)] transition-colors"
          >
            <img src={CTA_CHANNELS.telegram.logo} alt="Telegram" className="h-3.5 w-3.5 rounded-sm" width={14} height={14} /> Telegram Channel
          </a>
          <HeroEmailForm />
        </div>
      </div>
    </div>
  );
}

function HeroEmailForm() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = emailSchema.safeParse(email);
    if (!result.success) {
      toast.error(result.error.errors[0].message);
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase
        .from('email_subscribers' as any)
        .insert({ email: result.data, frequency: 'daily' } as any);
      if (error) {
        if (error.code === '23505') {
          toast.info('You are already subscribed!');
          setSubmitted(true);
        } else throw error;
      } else {
        setSubmitted(true);
        toast.success("Subscribed! You'll receive job alerts via email.");
      }
    } catch (err) {
      console.error('Subscription error:', err);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
      setEmail('');
    }
  };

  if (submitted) {
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/20 text-white text-xs font-semibold">
        ✓ Subscribed
      </span>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="inline-flex items-center gap-1">
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        required
        className="px-2 py-1 rounded-full text-xs w-28 bg-white/90 text-gray-900 placeholder:text-gray-500 outline-none"
      />
      <button
        type="submit"
        disabled={loading}
        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[hsl(4_80%_56%)] text-white text-xs font-semibold hover:bg-[hsl(4_80%_48%)] transition-colors disabled:opacity-50"
      >
        <img src={CTA_CHANNELS.email.logo} alt="Email" className="h-3.5 w-3.5 rounded-sm" />
        {loading ? '…' : 'Subscribe'}
      </button>
    </form>
  );
}