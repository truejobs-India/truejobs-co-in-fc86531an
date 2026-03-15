import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { MessageCircle, Send, Mail } from 'lucide-react';

interface ResourceSubscribeCTAProps {
  resourceId: string;
  onEvent: (eventType: string) => void;
}

export function ResourceSubscribeCTA({ resourceId, onEvent }: ResourceSubscribeCTAProps) {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('email_subscribers').insert({
        email,
        frequency: 'daily',
      });
      if (error && !error.message.includes('duplicate')) throw error;
      toast({ title: 'Subscribed!', description: 'You will receive govt job updates via email.' });
      onEvent('email_submit');
      setEmail('');
    } catch {
      toast({ title: 'Already subscribed', description: 'This email is already registered.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground">Stay Updated — Never Miss a Govt Job</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Button
          variant="outline"
          className="w-full gap-2 border-green-500 text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950"
          onClick={() => {
            onEvent('whatsapp_click');
            window.open('https://whatsapp.com/channel/0029VaYGqc3LY6d4kFPSRn0K', '_blank');
          }}
        >
          <MessageCircle className="h-4 w-4" />
          Join WhatsApp Channel
        </Button>

        <Button
          variant="outline"
          className="w-full gap-2 border-blue-500 text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950"
          onClick={() => {
            onEvent('telegram_click');
            window.open('https://t.me/truejobsindia', '_blank');
          }}
        >
          <Send className="h-4 w-4" />
          Join Telegram Channel
        </Button>
      </div>

      <form onSubmit={handleEmailSubmit} className="flex gap-2">
        <Input
          type="email"
          placeholder="Enter your email for job alerts"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="flex-1"
        />
        <Button type="submit" disabled={submitting} className="gap-2">
          <Mail className="h-4 w-4" />
          Subscribe
        </Button>
      </form>
    </div>
  );
}
