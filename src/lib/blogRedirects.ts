/**
 * Blog SEO redirect map.
 * Maps old/broken slugs to their corrected destinations.
 * Used by BlogPost.tsx to perform client-side redirects.
 * 
 * Special case: "/" means redirect to homepage (not a blog post).
 */
export const BLOG_REDIRECTS: Record<string, string> = {
  // SSC CGL merge — Article A → Article B
  'ssc-cgl-2026-kaise-kare-toppers-strategy-aur-90-study-plan': 'ssc-cgl-2026-preparation-guide',

  // 12 slug fixes
  'sarkari-naukri-me-taiyari-kaise-kare-2026-me-ke': 'sarkari-naukri-taiyari-kaise-kare-2026',
  'nps-vs-ops-2026-aur-nai-me-kya-hai': 'nps-vs-ops-difference-hindi-2026',
  'sarkari-naukri-me-se-bhatte-hai-2026-puri': 'sarkari-naukri-allowances-da-hra-ta-2026',
  'umr-ke-baad-hai-sarkari-2026-40-ke-baad': 'age-limit-ke-baad-sarkari-naukri-2026',
  'sarkari-pariksha-taiyari-hai-2026-strategy': 'sarkari-pariksha-taiyari-strategy-2026',
  'sarkari-naukri-me-kaise-hai-2026-ke-aur-puri-prakriya': 'sarkari-naukri-transfer-process-2026',
  'fake-sarkari-in-2026': 'fake-sarkari-naukri-website-se-bache-2026',
  'cbse-10th-result-2026-kab-aayega-yah-date-aur-puri-jaankari': 'cbse-10th-result-2026-kab-aayega',
  'employment-exchange-me-kaise-kare-2026-puri-jaankari-online-offline-process': 'employment-exchange-registration-kaise-kare-2026',
  'mahila-ke-liye-sarkari-2026-aur': 'mahila-ke-liye-sarkari-naukri-2026',
  'ssc-2026-calendar-exam-dates-vacancies-preparation-timeline': 'ssc-exam-calendar-2026-dates-vacancies',

  // Agniveer — both uppercase (Google-indexed) and lowercase variants
  'Agniveer-bharti-2026-aur-se-puri-jaankari': 'agniveer-bharti-2026-army-eligibility-salary',
  'agniveer-bharti-2026-aur-se-puri-jaankari': 'agniveer-bharti-2026-army-eligibility-salary',

  // Iran article → homepage
  'the-high-cost-of-conflict-analyzing-the-economic-shockwaves-of-the-us-israel-operation-in-iran': '/',
};
