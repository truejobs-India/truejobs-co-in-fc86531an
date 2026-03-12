// List of blocked personal/social email domains for employer signups
const BLOCKED_EMAIL_DOMAINS = [
  // Google
  'gmail.com',
  'googlemail.com',
  // Yahoo
  'yahoo.com',
  'yahoo.co.in',
  'yahoo.in',
  'ymail.com',
  'rocketmail.com',
  // Microsoft
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  // Apple
  'icloud.com',
  'me.com',
  'mac.com',
  // Other popular providers
  'aol.com',
  'protonmail.com',
  'proton.me',
  'zoho.com',
  'mail.com',
  'gmx.com',
  'gmx.net',
  'yandex.com',
  'rediffmail.com',
  'inbox.com',
  'fastmail.com',
  'tutanota.com',
  // Indian providers
  'rediff.com',
  'sify.com',
  'indiatimes.com',
];

export function isPersonalEmail(email: string): boolean {
  if (!email) return false;
  const domain = email.split('@')[1]?.toLowerCase();
  return BLOCKED_EMAIL_DOMAINS.includes(domain);
}

export function getEmailDomain(email: string): string {
  return email.split('@')[1]?.toLowerCase() || '';
}

export const EMPLOYER_EMAIL_ERROR = 'Please use your business email address. Personal email addresses (Gmail, Yahoo, Outlook, etc.) are not allowed for employer accounts.';
