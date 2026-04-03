import { Link } from 'react-router-dom';

import catSsc from '@/assets/cat-ssc.png';
import catUpsc from '@/assets/cat-upsc.png';
import catRailway from '@/assets/cat-railway.png';
import catBanking from '@/assets/cat-banking.png';
import catDefence from '@/assets/cat-defence.png';
import catTeaching from '@/assets/cat-teaching.png';
import catPolice from '@/assets/cat-police.png';
import catPsu from '@/assets/cat-psu.png';
import catState from '@/assets/cat-state.png';
import cat10th from '@/assets/cat-10th.png';
import cat12th from '@/assets/cat-12th.png';
import catGraduate from '@/assets/cat-graduate.png';

const CATEGORIES = [
  { label: 'SSC Jobs', img: catSsc, href: '/sarkari-jobs?dept=ssc' },
  { label: 'UPSC Jobs', img: catUpsc, href: '/sarkari-jobs?dept=upsc' },
  { label: 'Railway Jobs', img: catRailway, href: '/sarkari-jobs?dept=railway' },
  { label: 'Banking Jobs', img: catBanking, href: '/sarkari-jobs?dept=banking' },
  { label: 'Defence Jobs', img: catDefence, href: '/sarkari-jobs?dept=defence' },
  { label: 'Teaching Jobs', img: catTeaching, href: '/sarkari-jobs?dept=teaching' },
  { label: 'Police Jobs', img: catPolice, href: '/sarkari-jobs?dept=police' },
  { label: 'PSU Jobs', img: catPsu, href: '/sarkari-jobs?dept=psu' },
  { label: 'State Govt Jobs', img: catState, href: '/sarkari-jobs' },
  { label: '10th Pass Jobs', img: cat10th, href: '/10th-pass-govt-jobs' },
  { label: '12th Pass Jobs', img: cat12th, href: '/12th-pass-govt-jobs' },
  { label: 'Graduate Jobs', img: catGraduate, href: '/graduate-govt-jobs' },
];

export function GovtJobCategories() {
  return (
    <section className="py-6">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-foreground font-['Outfit',sans-serif]">Explore Government Job Categories</h2>
            <p className="text-muted-foreground text-sm mt-1">Browse by exam type, stream, and qualification</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {CATEGORIES.map(cat => (
            <Link
              key={cat.label}
              to={cat.href}
              className="flex flex-col items-center gap-2 rounded-2xl bg-card border border-border hover:shadow-medium transition-all text-center group overflow-hidden"
            >
              <div className="w-full aspect-square overflow-hidden bg-secondary/30 group-hover:scale-105 transition-transform">
                <img src={cat.img} alt={cat.label} className="w-full h-full object-cover" width={200} height={200} loading="lazy" />
              </div>
              <span className="text-sm font-semibold text-foreground pb-3 px-2">{cat.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
