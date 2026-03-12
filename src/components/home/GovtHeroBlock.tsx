import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const QUICK_LINKS = [
  { label: 'Latest Govt Jobs', href: '/sarkari-jobs' },
  { label: 'Results', href: '/sarkari-jobs?status=result_declared' },
  { label: 'Admit Card', href: '/sarkari-jobs?status=admit_card_released' },
  { label: 'Answer Key', href: '/sarkari-jobs' },
  { label: 'Syllabus', href: '/sarkari-jobs' },
  { label: 'Exam Calendar', href: '/sarkari-jobs' },
];

const DEPT_CHIPS = [
  { label: 'SSC', slug: 'ssc' },
  { label: 'UPSC', slug: 'upsc' },
  { label: 'Railway', slug: 'railway' },
  { label: 'Banking', slug: 'banking' },
  { label: 'Defence', slug: 'defence' },
  { label: 'Teaching', slug: 'teaching' },
  { label: 'Police', slug: 'police' },
  { label: 'PSU', slug: 'psu' },
];

export function GovtHeroBlock() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) navigate(`/sarkari-jobs?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[hsl(25,95%,50%)] to-[hsl(15,90%,55%)] p-6 md:p-8 text-white min-h-[360px]"
      style={{ boxShadow: '0 10px 30px hsla(25, 95%, 40%, 0.15)' }}
    >
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-56 h-56 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

      <div className="relative z-10">
        {/* Pill */}
        <span className="inline-block bg-amber-500 text-gray-900 px-3 py-1.5 rounded-full text-xs font-bold mb-4">
          Government jobs platform • Updated daily
        </span>

        <h1 className="text-2xl sm:text-3xl md:text-[42px] md:leading-[1.15] font-extrabold mb-3 font-['Outfit',sans-serif]">
          Latest Government Jobs, Results, Admit Cards & Exams
        </h1>
        <p className="text-white/80 text-sm md:text-[17px] md:leading-relaxed mb-5 max-w-[90%]">
          Find verified Sarkari job updates, exam notifications, answer keys, results, admit cards, and state-wise government vacancies in one place.
        </p>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex gap-2 bg-white rounded-2xl p-2.5 mb-5">
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search government jobs, exams, results, admit cards..."
            className="flex-1 border-none shadow-none text-foreground placeholder:text-muted-foreground focus-visible:ring-0 text-base"
          />
          <Button type="submit" className="bg-amber-500 hover:bg-amber-600 text-foreground font-extrabold rounded-xl px-5">
            Search
          </Button>
        </form>

        {/* Quick links chips */}
        <div className="flex flex-wrap gap-2 mb-4">
          {QUICK_LINKS.map(l => (
            <Link
              key={l.label}
              to={l.href}
              className="px-3 py-2 rounded-full bg-amber-500 text-gray-900 text-xs font-bold hover:bg-amber-400 transition-colors"
            >
              {l.label}
            </Link>
          ))}
        </div>

        {/* Department chips */}
        <div className="flex flex-wrap gap-2">
          {DEPT_CHIPS.map(d => (
            <Link
              key={d.slug}
              to={`/sarkari-jobs?dept=${d.slug}`}
              className="px-3 py-2 rounded-full bg-amber-500 text-gray-900 text-xs font-bold hover:bg-amber-400 transition-colors"
            >
              {d.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
