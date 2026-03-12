import { MessageCircle, Send, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';

export function AlertSignupBanner() {
  return (
    <section className="py-6">
      <div className="container mx-auto px-4">
        <div className="rounded-3xl bg-gradient-to-r from-[hsl(25,95%,50%)] to-[hsl(15,90%,45%)] p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-5 text-white">
          <div>
            <h2 className="text-xl md:text-2xl font-bold mb-2 font-['Outfit',sans-serif]">
              Get Free Job Alerts
            </h2>
            <p className="text-blue-100 text-sm">
              Join WhatsApp, Telegram, or email alerts for daily government job updates.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => window.open('https://wa.me/919876543210?text=Subscribe%20to%20job%20alerts', '_blank')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.12] text-white border border-white/[0.18] text-xs font-medium hover:bg-white/25 transition-colors"
            >
              <MessageCircle className="h-3.5 w-3.5" /> WhatsApp Alerts
            </button>
            <button
              onClick={() => window.open('https://t.me/truejobsindia', '_blank')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.12] text-white border border-white/[0.18] text-xs font-medium hover:bg-white/25 transition-colors"
            >
              <Send className="h-3.5 w-3.5" /> Telegram Channel
            </button>
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.12] text-white border border-white/[0.18] text-xs font-medium hover:bg-white/25 transition-colors"
            >
              <Mail className="h-3.5 w-3.5" /> Email Alerts
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
