import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCookieConsent, ConsentState } from '@/hooks/useCookieConsent';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Shield, Settings } from 'lucide-react';

export function CookieConsentBanner() {
  const { consent, isLoaded, updateConsent } = useCookieConsent();
  const [showPreferences, setShowPreferences] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(true);
  const [advertisingEnabled, setAdvertisingEnabled] = useState(true);

  // Only show when consent is null (not yet given) and hook has loaded
  if (!isLoaded || consent !== null) return null;

  const handleAcceptAll = () => {
    const allGranted: ConsentState = {
      ad_storage: 'granted',
      analytics_storage: 'granted',
      ad_personalization: 'granted',
      ad_user_data: 'granted',
    };
    updateConsent(allGranted);
  };

  const handleSavePreferences = () => {
    const state: ConsentState = {
      ad_storage: advertisingEnabled ? 'granted' : 'denied',
      analytics_storage: analyticsEnabled ? 'granted' : 'denied',
      ad_personalization: advertisingEnabled ? 'granted' : 'denied',
      ad_user_data: advertisingEnabled ? 'granted' : 'denied',
    };
    updateConsent(state);
    setShowPreferences(false);
  };

  return (
    <>
      {/* Consent Banner — fixed bottom, z-[45]: below exit popup (z-50), above sticky CTA (z-40) */}
      <div className="fixed bottom-0 left-0 right-0 z-[45] border-t bg-background shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        <div className="container mx-auto px-4 py-4 md:py-5">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
            <div className="flex items-start gap-3 flex-1">
              <Shield className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground leading-relaxed">
                We use cookies to personalise content and ads, and to analyse our traffic. 
                Personalised ads help keep TrueJobs free. You can manage preferences anytime.{' '}
                <Link to="/privacypolicy" className="text-primary underline hover:text-primary/80">
                  Privacy Policy
                </Link>
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0 w-full md:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPreferences(true)}
                className="flex-1 md:flex-none gap-2"
              >
                <Settings className="h-4 w-4" />
                Manage Preferences
              </Button>
              <Button
                size="sm"
                onClick={handleAcceptAll}
                className="flex-1 md:flex-none"
              >
                Accept All Cookies
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Manage Preferences Dialog */}
      <Dialog open={showPreferences} onOpenChange={setShowPreferences}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cookie Preferences</DialogTitle>
            <DialogDescription>
              Choose which cookies you'd like to allow. Essential cookies are always active 
              as they are necessary for the website to function.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Essential — always on */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div>
                <p className="text-sm font-medium">Essential Cookies</p>
                <p className="text-xs text-muted-foreground">Required for site functionality</p>
              </div>
              <Switch checked disabled aria-label="Essential cookies always enabled" />
            </div>

            {/* Analytics */}
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <p className="text-sm font-medium">Analytics Cookies</p>
                <p className="text-xs text-muted-foreground">Help us understand site usage</p>
              </div>
              <Switch
                checked={analyticsEnabled}
                onCheckedChange={setAnalyticsEnabled}
                aria-label="Toggle analytics cookies"
              />
            </div>

            {/* Advertising */}
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <p className="text-sm font-medium">Advertising Cookies</p>
                <p className="text-xs text-muted-foreground">Enable personalised ad experience</p>
              </div>
              <Switch
                checked={advertisingEnabled}
                onCheckedChange={setAdvertisingEnabled}
                aria-label="Toggle advertising cookies"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setShowPreferences(false)}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={handleSavePreferences}>
              Save Preferences
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
