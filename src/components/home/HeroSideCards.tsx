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
          <button
            onClick={() => window.open('https://wa.me/919876543210?text=Subscribe%20to%20job%20alerts', '_blank')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#25D366] text-white text-xs font-semibold hover:bg-[#20BD5A] transition-colors"
          >
            <MessageCircle className="h-3.5 w-3.5" /> WhatsApp Alerts
          </button>
          <button
            onClick={() => window.open('https://t.me/truejobsindia', '_blank')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0088cc] text-white text-xs font-semibold hover:bg-[#006fa3] transition-colors"
          >
            <Send className="h-3.5 w-3.5" /> Telegram Channel
          </button>
          <Link
            to="/signup"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#EA4335] text-white text-xs font-semibold hover:bg-[#d33426] transition-colors"
          >
            <Mail className="h-3.5 w-3.5" /> Email Alerts
          </Link>
        </div>
      </div>
    </div>
  );
}