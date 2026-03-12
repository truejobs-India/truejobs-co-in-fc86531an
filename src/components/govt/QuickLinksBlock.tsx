import { Link } from 'react-router-dom';
import { ArrowRight, Briefcase, GraduationCap, MapPin, Calendar } from 'lucide-react';

interface QuickLinksBlockProps {
  departmentSlug?: string | null;
  states?: string[];
  qualificationRequired?: string | null;
}

const DEPT_MAP: Record<string, { label: string; slug: string }> = {
  ssc: { label: 'SSC Jobs', slug: '/ssc-jobs' },
  railway: { label: 'Railway Jobs', slug: '/railway-jobs' },
  banking: { label: 'Banking Jobs', slug: '/banking-jobs' },
  upsc: { label: 'UPSC Jobs', slug: '/upsc-jobs' },
  defence: { label: 'Defence Jobs', slug: '/defence-jobs' },
};

const QUAL_MAP: Record<string, string> = {
  '10th': '/10th-pass-govt-jobs',
  '12th': '/12th-pass-govt-jobs',
  'graduate': '/graduate-govt-jobs',
  'graduation': '/graduate-govt-jobs',
  'post graduate': '/post-graduate-govt-jobs',
  'engineering': '/engineering-govt-jobs',
  'iti': '/iti-govt-jobs',
};

const STATE_SLUG_MAP: Record<string, string> = {
  'uttar pradesh': 'uttar-pradesh', 'bihar': 'bihar', 'rajasthan': 'rajasthan',
  'madhya pradesh': 'madhya-pradesh', 'maharashtra': 'maharashtra', 'delhi': 'delhi',
  'haryana': 'haryana', 'karnataka': 'karnataka', 'tamil nadu': 'tamil-nadu',
  'west bengal': 'west-bengal', 'punjab': 'punjab', 'jharkhand': 'jharkhand',
  'gujarat': 'gujarat', 'odisha': 'odisha', 'chhattisgarh': 'chhattisgarh',
  'telangana': 'telangana', 'andhra pradesh': 'andhra-pradesh', 'kerala': 'kerala',
};

export function QuickLinksBlock({ departmentSlug, states, qualificationRequired }: QuickLinksBlockProps) {
  const links: { icon: typeof Briefcase; label: string; href: string }[] = [];

  // Department link
  if (departmentSlug && DEPT_MAP[departmentSlug]) {
    links.push({ icon: Briefcase, label: DEPT_MAP[departmentSlug].label, href: DEPT_MAP[departmentSlug].slug });
  }

  // State links (first 2)
  if (states && states.length > 0) {
    for (const s of states.slice(0, 2)) {
      const slug = STATE_SLUG_MAP[s.toLowerCase()];
      if (slug) {
        links.push({ icon: MapPin, label: `Govt Jobs ${s}`, href: `/govt-jobs-${slug}` });
      }
    }
  }

  // Qualification link
  if (qualificationRequired) {
    const qLower = qualificationRequired.toLowerCase();
    for (const [key, href] of Object.entries(QUAL_MAP)) {
      if (qLower.includes(key)) {
        links.push({ icon: GraduationCap, label: `${key.charAt(0).toUpperCase() + key.slice(1)} Govt Jobs`, href });
        break;
      }
    }
  }

  // Always add deadline pages
  links.push({ icon: Calendar, label: 'Last Date Today', href: '/govt-jobs-last-date-today' });
  links.push({ icon: Calendar, label: 'All Sarkari Jobs A-Z', href: '/all-sarkari-jobs' });

  if (links.length === 0) return null;

  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold text-foreground mb-3">Quick Links</h2>
      <div className="flex flex-wrap gap-2">
        {links.map((link, i) => {
          const Icon = link.icon;
          return (
            <Link
              key={i}
              to={link.href}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-card text-sm font-medium text-foreground hover:bg-accent hover:border-primary/30 transition-all group"
            >
              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              {link.label}
              <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
