import { Link } from 'react-router-dom';
import type { RelatedExamLink } from '@/data/examAuthority/types';

interface RelatedExamLinksProps {
  relatedExams?: RelatedExamLink[];
  departmentSlug: string;
}

const TOOL_LINKS: RelatedExamLink[] = [
  { label: 'Government Salary Calculator', href: '/govt-salary-calculator' },
  { label: 'Age Calculator for Govt Jobs', href: '/govt-job-age-calculator' },
  { label: 'Govt Exam Calendar 2026', href: '/govt-exam-calendar' },
  { label: 'Exam Eligibility Checker', href: '/govt-exam-eligibility-checker' },
  { label: 'Latest Govt Jobs', href: '/latest-govt-jobs' },
];

const GUIDE_LINKS: RelatedExamLink[] = [
  { label: 'SSC CGL Preparation Guide', href: '/blog/ssc-cgl-preparation-guide' },
  { label: 'Govt Jobs After 12th', href: '/blog/govt-jobs-after-12th-guide' },
  { label: 'Railway Jobs Career Guide', href: '/blog/railway-jobs-guide' },
  { label: 'Govt Salary Calculation Guide', href: '/blog/govt-salary-calculation-guide' },
  { label: 'NDA Preparation Strategy', href: '/blog/nda-preparation-guide' },
];

const DEPT_AUTHORITY_MAP: Record<string, RelatedExamLink[]> = {
  ssc: [
    { label: 'SSC CGL 2026 Notification', href: '/ssc-cgl-2026-notification' },
    { label: 'SSC CHSL 2026 Notification', href: '/ssc-chsl-2026-notification' },
    { label: 'SSC GD 2026 Notification', href: '/ssc-gd-2026-notification' },
  ],
  railway: [
    { label: 'RRB NTPC 2026 Notification', href: '/rrb-ntpc-2026-notification' },
    { label: 'Railway Group D 2026', href: '/railway-group-d-2026-notification' },
    { label: 'RRB ALP 2026', href: '/rrb-alp-2026-notification' },
  ],
  banking: [
    { label: 'IBPS PO 2026 Notification', href: '/ibps-po-2026-notification' },
    { label: 'SBI PO 2026 Notification', href: '/sbi-po-2026-notification' },
    { label: 'IBPS Clerk 2026', href: '/ibps-clerk-2026-notification' },
  ],
  defence: [
    { label: 'NDA 2026 Notification', href: '/nda-2026-notification' },
    { label: 'Agniveer 2026', href: '/agniveer-2026-notification' },
    { label: 'UPSC CSE 2026', href: '/upsc-cse-2026-notification' },
  ],
  upsc: [
    { label: 'UPSC CSE 2026 Notification', href: '/upsc-cse-2026-notification' },
    { label: 'NDA 2026 Notification', href: '/nda-2026-notification' },
  ],
};

export function RelatedExamLinks({ relatedExams = [], departmentSlug }: RelatedExamLinksProps) {
  const departmentLink: RelatedExamLink = {
    label: `All ${departmentSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} Jobs`,
    href: `/${departmentSlug}-jobs`,
  };

  // Pick 2 guides relevant to department
  const deptGuides = departmentSlug.includes('ssc')
    ? GUIDE_LINKS.filter(g => g.href.includes('ssc') || g.href.includes('salary'))
    : departmentSlug.includes('railway')
    ? GUIDE_LINKS.filter(g => g.href.includes('railway') || g.href.includes('salary'))
    : departmentSlug.includes('banking')
    ? GUIDE_LINKS.filter(g => g.href.includes('ibps') || g.href.includes('sbi') || g.href.includes('salary'))
    : GUIDE_LINKS.slice(0, 2);

  const allLinks = [
    ...relatedExams,
    departmentLink,
    ...(DEPT_AUTHORITY_MAP[departmentSlug] || []),
    ...TOOL_LINKS,
    ...deptGuides,
  ];

  // Deduplicate by href
  const seen = new Set<string>();
  const uniqueLinks = allLinks.filter(l => {
    if (seen.has(l.href)) return false;
    seen.add(l.href);
    return true;
  });

  return (
    <section className="mb-10">
      <h2 className="text-2xl font-semibold text-foreground mb-4">Related Links & Tools</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {uniqueLinks.map((link, i) => (
          <Link
            key={i}
            to={link.href}
            className="rounded-lg border bg-card px-4 py-3 text-sm font-medium text-primary hover:bg-accent transition-colors"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
