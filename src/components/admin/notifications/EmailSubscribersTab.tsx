import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Mail, Search, Send, Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Subscriber {
  id: string;
  email: string;
  is_active: boolean;
  verified: boolean;
  frequency: string;
  job_categories: string[] | null;
  subscribed_at: string;
  unsubscribed_at: string | null;
}

export function EmailSubscribersTab() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Compose state
  const [subject, setSubject] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [ctaLabel, setCtaLabel] = useState('');
  const [ctaUrl, setCtaUrl] = useState('');
  const [testEmail, setTestEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sendMode, setSendMode] = useState<'test' | 'broadcast'>('broadcast');

  useEffect(() => { fetchSubscribers(); }, []);

  const fetchSubscribers = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('email_subscribers')
      .select('id, email, is_active, verified, frequency, job_categories, subscribed_at, unsubscribed_at')
      .order('subscribed_at', { ascending: false });
    setSubscribers((data as Subscriber[]) || []);
    setLoading(false);
  };

  const filtered = subscribers.filter(s =>
    s.email.toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = subscribers.filter(s => s.is_active).length;

  const handleSend = async (mode: 'test' | 'broadcast') => {
    if (!messageBody.trim()) {
      toast.error('Message body is required');
      return;
    }
    if (mode === 'test' && !testEmail.trim()) {
      toast.error('Enter a test email address');
      return;
    }

    setSendMode(mode);
    setConfirmOpen(true);
  };

  const executeSend = async () => {
    setConfirmOpen(false);
    setSending(true);
    try {
      const payload: Record<string, unknown> = {
        channel: 'email',
        subject: subject || 'Job Alert from TrueJobs',
        message_body: messageBody,
      };
      if (ctaLabel) payload.cta_label = ctaLabel;
      if (ctaUrl) payload.cta_url = ctaUrl;
      if (sendMode === 'test') payload.test_email = testEmail;

      const { data, error } = await supabase.functions.invoke('admin-send-notification', {
        body: payload,
      });

      if (error) throw error;

      toast.success(`Sent: ${data.sent_count}, Failed: ${data.failed_count}`);
    } catch (err: any) {
      console.error('Send error:', err);
      const functionError = err?.context ? await err.context.json().catch(() => null) : null;
      toast.error(functionError?.detail || functionError?.error || err?.message || 'Send failed');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Subscriber Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Mail className="h-4 w-4" /> Email Subscribers ({activeCount} active)
            </CardTitle>
            <div className="relative w-48">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4">Email</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2 pr-4">Verified</th>
                    <th className="pb-2 pr-4">Frequency</th>
                    <th className="pb-2 pr-4">Categories</th>
                    <th className="pb-2">Subscribed</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => (
                    <tr key={s.id} className="border-b border-border/50">
                      <td className="py-2 pr-4 font-mono">{s.email}</td>
                      <td className="py-2 pr-4">
                        <Badge variant={s.is_active ? 'default' : 'secondary'} className="text-[10px]">
                          {s.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4">
                        <Badge variant={s.verified ? 'default' : 'outline'} className="text-[10px]">
                          {s.verified ? 'Yes' : 'No'}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4">{s.frequency}</td>
                      <td className="py-2 pr-4 max-w-[120px] truncate">
                        {s.job_categories?.join(', ') || '—'}
                      </td>
                      <td className="py-2">{new Date(s.subscribed_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={6} className="py-4 text-center text-muted-foreground">No subscribers found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Compose & Send */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Send className="h-4 w-4" /> Compose Email Broadcast
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Subject (e.g., New Govt Jobs This Week)"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="text-sm"
          />
          <Textarea
            placeholder="Message body (plain text, line breaks supported)"
            value={messageBody}
            onChange={(e) => setMessageBody(e.target.value)}
            rows={5}
            className="text-sm"
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              placeholder="CTA Label (optional, e.g., View Jobs)"
              value={ctaLabel}
              onChange={(e) => setCtaLabel(e.target.value)}
              className="text-sm"
            />
            <Input
              placeholder="CTA URL (optional)"
              value={ctaUrl}
              onChange={(e) => setCtaUrl(e.target.value)}
              className="text-sm"
            />
          </div>
          <div className="flex items-center gap-3 pt-2">
            <Input
              placeholder="Test email address"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="text-sm w-60"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleSend('test')}
              disabled={sending}
            >
              {sending && sendMode === 'test' && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              Send Test
            </Button>
            <Button
              size="sm"
              onClick={() => handleSend('broadcast')}
              disabled={sending}
            >
              {sending && sendMode === 'broadcast' && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              Send to All ({activeCount})
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {sendMode === 'test' ? 'Send Test Email?' : `Send to ${activeCount} subscribers?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {sendMode === 'test'
                ? `A test email will be sent to ${testEmail}.`
                : `This will send the email to all ${activeCount} active subscribers. This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeSend}>
              {sendMode === 'test' ? 'Send Test' : 'Confirm Send'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
