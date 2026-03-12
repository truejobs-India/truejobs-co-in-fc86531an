import { Link } from 'react-router-dom';
import { Banknote, Monitor, Wifi, UserPlus } from 'lucide-react';

const CATEGORIES = [
  { title: 'Banking Jobs', desc: 'Private banking and finance opportunities.', icon: Banknote, href: '/jobs?industry=banking', color: 'text-green-600 bg-green-50' },
  { title: 'IT Jobs', desc: 'Software, support, and technical roles.', icon: Monitor, href: '/jobs?industry=it', color: 'text-blue-600 bg-blue-50' },
  { title: 'Remote Jobs', desc: 'Flexible and work-from-home jobs.', icon: Wifi, href: '/jobs?type=remote', color: 'text-purple-600 bg-purple-50' },
  { title: 'Fresher Jobs', desc: 'Entry-level opportunities for new candidates.', icon: UserPlus, href: '/jobs?experience=fresher', color: 'text-amber-600 bg-amber-50' },
];

export function PrivateJobsExplore() {
  return (
    <section className="py-6">
      <div className="container mx-auto px-4">
        <div className="mb-4">
          <h2 className="text-xl md:text-2xl font-bold text-foreground font-['Outfit',sans-serif]">Also Explore Private Jobs</h2>
          <p className="text-muted-foreground text-sm mt-1">Secondary section, below the govt-first journey</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {CATEGORIES.map(cat => (
            <Link
              key={cat.title}
              to={cat.href}
              className="bg-card rounded-2xl p-5 border border-border hover:shadow-medium transition-all group"
            >
              <div className={`inline-flex p-2.5 rounded-xl ${cat.color} mb-3 group-hover:scale-110 transition-transform`}>
                <cat.icon className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-1 font-['Outfit',sans-serif]">{cat.title}</h3>
              <p className="text-muted-foreground text-sm">{cat.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
