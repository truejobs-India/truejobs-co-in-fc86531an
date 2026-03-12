import { Link } from 'react-router-dom';

interface ContextualLinksProps {
  departmentSlug?: string | null;
  states?: string[];
}

const DEPT_COMBO_LINKS: Record<string, { label: string; slug: string }[]> = {
  ssc: [
    { label: 'SSC Jobs Bihar', slug: '/ssc-jobs-bihar' },
    { label: 'SSC Jobs UP', slug: '/ssc-jobs-uttar-pradesh' },
    { label: 'SSC Graduate Jobs', slug: '/ssc-graduate-jobs' },
    { label: 'SSC 10th Pass Jobs', slug: '/ssc-10th-pass-jobs' },
  ],
  railway: [
    { label: 'Railway Jobs Bihar', slug: '/railway-jobs-bihar' },
    { label: 'Railway Jobs UP', slug: '/railway-jobs-uttar-pradesh' },
    { label: 'Railway 10th Pass Jobs', slug: '/railway-10th-pass-jobs' },
    { label: 'Railway ITI Jobs', slug: '/railway-iti-jobs' },
  ],
  banking: [
    { label: 'Banking Jobs Maharashtra', slug: '/banking-jobs-maharashtra' },
    { label: 'Banking Jobs Delhi', slug: '/banking-jobs-delhi' },
    { label: 'Banking Graduate Jobs', slug: '/banking-graduate-jobs' },
  ],
  upsc: [
    { label: 'UPSC Jobs Delhi', slug: '/upsc-jobs-delhi' },
    { label: 'UPSC Graduate Jobs', slug: '/upsc-graduate-jobs' },
    { label: 'UPSC Post Graduate Jobs', slug: '/upsc-post-graduate-jobs' },
  ],
  defence: [
    { label: 'Defence Jobs UP', slug: '/defence-jobs-uttar-pradesh' },
    { label: 'Defence 10th Pass Jobs', slug: '/defence-10th-pass-jobs' },
    { label: 'Defence 12th Pass Jobs', slug: '/defence-12th-pass-jobs' },
  ],
};

export function ContextualLinks({ departmentSlug, states }: ContextualLinksProps) {
  const comboLinks = departmentSlug ? DEPT_COMBO_LINKS[departmentSlug] || [] : [];
  
  if (comboLinks.length === 0) return null;

  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold text-foreground mb-3">Explore More</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {comboLinks.map((link, i) => (
          <Link
            key={i}
            to={link.slug}
            className="px-3 py-2.5 rounded-lg border border-border bg-card text-sm text-foreground hover:bg-accent hover:text-primary hover:border-primary/30 transition-all text-center"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
