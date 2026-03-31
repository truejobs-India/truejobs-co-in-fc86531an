import { Link } from 'react-router-dom';
import { CTA_CHANNELS } from '@/lib/ctaConfig';

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
            <img src={CTA_CHANNELS.whatsapp.logo} alt="WhatsApp" className="h-3.5 w-3.5 rounded-sm" /> WhatsApp Alerts
          </a>
          <a
            href={CTA_CHANNELS.telegram.url}
            target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[hsl(200_100%_40%)] text-white text-xs font-semibold hover:bg-[hsl(200_100%_35%)] transition-colors"
          >
            <img src={CTA_CHANNELS.telegram.logo} alt="Telegram" className="h-3.5 w-3.5 rounded-sm" /> Telegram Channel
          </a>
          <Link
            to="/email-subscribe"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[hsl(4_80%_56%)] text-white text-xs font-semibold hover:bg-[hsl(4_80%_48%)] transition-colors"
          >
            <img src={CTA_CHANNELS.email.logo} alt="Email" className="h-3.5 w-3.5 rounded-sm" /> Email Alerts
          </Link>
        </div>
      </div>
    </div>
  );
}