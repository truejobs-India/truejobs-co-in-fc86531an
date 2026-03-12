import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import type { ExamHubConfig } from '@/data/examAuthority/hubs/types';

interface PopularExamsBlockProps {
  departmentSlug?: string;
  qualificationSlug?: string;
}

const DEPARTMENT_MAP: Record<string, string[]> = {
  'ssc-jobs': ['ssc-cgl-hub', 'ssc-chsl-hub', 'ssc-gd-hub'],
  'railway-jobs': ['rrb-ntpc-hub', 'railway-group-d-hub', 'rrb-alp-hub'],
  'banking-jobs': ['ibps-po-hub', 'sbi-po-hub', 'ibps-clerk-hub'],
  'upsc-jobs': ['upsc-cse-hub', 'nda-hub', 'agniveer-hub'],
  'defence-jobs': ['nda-hub', 'agniveer-hub', 'upsc-cse-hub'],
};

const QUALIFICATION_MAP: Record<string, string[]> = {
  'graduation-govt-jobs': ['ssc-cgl-hub', 'ibps-po-hub', 'upsc-cse-hub'],
  '12th-pass-govt-jobs': ['ssc-chsl-hub', 'rrb-ntpc-hub', 'nda-hub'],
  '10th-pass-govt-jobs': ['ssc-gd-hub', 'railway-group-d-hub', 'ssc-mts-hub'],
};

const DEFAULT_HUBS = ['ssc-cgl-hub', 'rrb-ntpc-hub', 'ibps-po-hub'];

const HUB_DESCRIPTIONS: Record<string, string> = {
  'ssc-cgl-hub': 'Combined Graduate Level exam for Group B & C posts in central ministries.',
  'ssc-chsl-hub': 'Combined Higher Secondary Level exam for LDC, DEO & PA/SA posts.',
  'ssc-gd-hub': 'GD Constable recruitment for CAPFs, NIA, SSF and Rifleman in Assam Rifles.',
  'ssc-mts-hub': 'Multi Tasking Staff exam for Group C non-technical posts.',
  'ssc-cpo-hub': 'Sub Inspector recruitment for Delhi Police, CAPFs and CISF.',
  'rrb-ntpc-hub': 'Non-Technical Popular Categories for graduate & 12th pass railway posts.',
  'railway-group-d-hub': 'Level 1 posts including Track Maintainer, Helper and Porter.',
  'rrb-alp-hub': 'Assistant Loco Pilot and Technician recruitment in Indian Railways.',
  'rrb-je-hub': 'Junior Engineer recruitment across railway zones and production units.',
  'ibps-po-hub': 'Probationary Officer recruitment for 11 public sector banks.',
  'ibps-clerk-hub': 'Clerical cadre recruitment for public sector banks across India.',
  'sbi-po-hub': 'Probationary Officer recruitment for State Bank of India.',
  'sbi-clerk-hub': 'Junior Associate recruitment for SBI branches nationwide.',
  'upsc-cse-hub': 'Civil Services Examination for IAS, IPS, IFS and allied services.',
  'nda-hub': 'National Defence Academy exam for Army, Navy and Air Force entry.',
  'agniveer-hub': 'Agnipath scheme recruitment for Indian Armed Forces.',
};

export function PopularExamsBlock({ departmentSlug, qualificationSlug }: PopularExamsBlockProps) {
  const [hubs, setHubs] = useState<(ExamHubConfig | undefined)[]>([]);

  const slugs = (departmentSlug && DEPARTMENT_MAP[departmentSlug])
    || (qualificationSlug && QUALIFICATION_MAP[qualificationSlug])
    || DEFAULT_HUBS;

  useEffect(() => {
    import('@/data/examAuthority/hubs').then(m => {
      setHubs(slugs.map(s => m.getHubConfig(s)));
    });
  }, [departmentSlug, qualificationSlug]);

  const cards = slugs.map((slug, i) => ({
    slug,
    name: hubs[i]?.examName || slug.replace(/-hub$/, '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    description: HUB_DESCRIPTIONS[slug] || 'Complete exam guide with syllabus, pattern, and salary details.',
  }));

  return (
    <section className="mb-10 mt-10">
      <h2 className="text-2xl font-semibold text-foreground mb-4">Top Government Exams to Apply For</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map((card) => (
          <Link
            key={card.slug}
            to={`/${card.slug}`}
            className="rounded-lg border bg-card p-4 hover:bg-accent transition-colors group"
          >
            <h3 className="text-base font-semibold text-primary group-hover:underline mb-1">
              {card.name}
            </h3>
            <p className="text-sm text-muted-foreground mb-2">{card.description}</p>
            <span className="text-xs font-medium text-primary">View Complete Guide →</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
