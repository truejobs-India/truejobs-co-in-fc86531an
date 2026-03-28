import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAdminToast as useToast } from '@/contexts/AdminMessagesContext';
import { supabase } from '@/integrations/supabase/client';
import { Save, RefreshCw } from 'lucide-react';

interface ChatbotConfig {
  chatbot_enabled: { enabled: boolean };
  chatbot_welcome_message: { en: string; hi: string };
  chatbot_suggested_prompts: { prompts: string[] };
  chatbot_fallback_message: { en: string; hi: string };
  chatbot_blocked_phrases: { phrases: string[] };
}

export function ChatbotSettingsManager() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<ChatbotConfig>({
    chatbot_enabled: { enabled: true },
    chatbot_welcome_message: { en: '', hi: '' },
    chatbot_suggested_prompts: { prompts: [] },
    chatbot_fallback_message: { en: '', hi: '' },
    chatbot_blocked_phrases: { phrases: [] },
  });

  const loadSettings = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', Object.keys(config));

      if (data) {
        const updated = { ...config };
        for (const row of data) {
          (updated as any)[row.key] = row.value;
        }
        setConfig(updated);
      }
    } catch (err) {
      console.error('Failed to load chatbot settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSettings(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const saveKey = async (key: string, value: any) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('app_settings')
        .update({ value, updated_at: new Date().toISOString() })
        .eq('key', key);

      if (error) throw error;
      toast({ title: 'Saved', description: `${key} updated successfully.` });
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to save setting.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Card><CardContent className="p-6 text-muted-foreground">Loading settings...</CardContent></Card>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between">
            Chatbot Settings
            <Button variant="outline" size="sm" onClick={loadSettings}><RefreshCw className="h-4 w-4 mr-2" />Refresh</Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable/Disable */}
          <div className="flex items-center justify-between">
            <Label>Chatbot Enabled</Label>
            <Switch
              checked={config.chatbot_enabled.enabled}
              onCheckedChange={(checked) => {
                const val = { enabled: checked };
                setConfig(c => ({ ...c, chatbot_enabled: val }));
                saveKey('chatbot_enabled', val);
              }}
            />
          </div>

          {/* Welcome Message */}
          <div className="space-y-2">
            <Label>Welcome Message (English)</Label>
            <Textarea
              value={config.chatbot_welcome_message.en}
              onChange={(e) => setConfig(c => ({ ...c, chatbot_welcome_message: { ...c.chatbot_welcome_message, en: e.target.value } }))}
              rows={2}
            />
            <Label>Welcome Message (Hindi)</Label>
            <Textarea
              value={config.chatbot_welcome_message.hi}
              onChange={(e) => setConfig(c => ({ ...c, chatbot_welcome_message: { ...c.chatbot_welcome_message, hi: e.target.value } }))}
              rows={2}
            />
            <Button size="sm" onClick={() => saveKey('chatbot_welcome_message', config.chatbot_welcome_message)} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />Save Welcome Message
            </Button>
          </div>

          {/* Suggested Prompts */}
          <div className="space-y-2">
            <Label>Suggested Prompts (one per line)</Label>
            <Textarea
              value={config.chatbot_suggested_prompts.prompts.join('\n')}
              onChange={(e) => setConfig(c => ({ ...c, chatbot_suggested_prompts: { prompts: e.target.value.split('\n').filter(Boolean) } }))}
              rows={5}
            />
            <Button size="sm" onClick={() => saveKey('chatbot_suggested_prompts', config.chatbot_suggested_prompts)} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />Save Prompts
            </Button>
          </div>

          {/* Fallback Message */}
          <div className="space-y-2">
            <Label>Fallback Message (English)</Label>
            <Input
              value={config.chatbot_fallback_message.en}
              onChange={(e) => setConfig(c => ({ ...c, chatbot_fallback_message: { ...c.chatbot_fallback_message, en: e.target.value } }))}
            />
            <Label>Fallback Message (Hindi)</Label>
            <Input
              value={config.chatbot_fallback_message.hi}
              onChange={(e) => setConfig(c => ({ ...c, chatbot_fallback_message: { ...c.chatbot_fallback_message, hi: e.target.value } }))}
            />
            <Button size="sm" onClick={() => saveKey('chatbot_fallback_message', config.chatbot_fallback_message)} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />Save Fallback
            </Button>
          </div>

          {/* Blocked Phrases */}
          <div className="space-y-2">
            <Label>Blocked Phrases (comma-separated)</Label>
            <Input
              value={config.chatbot_blocked_phrases.phrases.join(', ')}
              onChange={(e) => setConfig(c => ({ ...c, chatbot_blocked_phrases: { phrases: e.target.value.split(',').map(s => s.trim()).filter(Boolean) } }))}
            />
            <Button size="sm" onClick={() => saveKey('chatbot_blocked_phrases', config.chatbot_blocked_phrases)} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />Save Blocked Phrases
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
