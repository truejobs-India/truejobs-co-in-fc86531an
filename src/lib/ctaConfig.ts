/**
 * Single source of truth for all CTA channel URLs, labels, and logos.
 * Every CTA surface must import from here. No inline URLs anywhere.
 */
import whatsappLogo from '@/assets/whatsapp-logo.jpg';
import telegramLogo from '@/assets/telegram-logo.jpg';
import emailLogo from '@/assets/email-logo.png';

export const CTA_CHANNELS = {
  whatsapp: {
    label: 'WhatsApp Alert',
    url: 'https://wa.me/917982306492?text=Subscribe%20to%20job%20alerts',
    logo: whatsappLogo,
    bgClass: 'bg-[hsl(142_70%_40%)] hover:bg-[hsl(142_70%_35%)]',
  },
  telegram: {
    label: 'Telegram Alert',
    url: 'https://t.me/truejobs_alerts',
    logo: telegramLogo,
    bgClass: 'bg-[hsl(200_100%_40%)] hover:bg-[hsl(200_100%_35%)]',
  },
  email: {
    label: 'Email Alert',
    logo: emailLogo,
  },
} as const;

export const CTA_TRUST_LINE = 'Free • No spam • Unsubscribe anytime';
