import { TelegramAlertWidget } from './TelegramAlertWidget';
import { EmailDigestCapture } from './EmailDigestCapture';

export function DistributionSidebar() {
  return (
    <div className="space-y-4">
      <EmailDigestCapture variant="card" />
      <TelegramAlertWidget />
    </div>
  );
}
