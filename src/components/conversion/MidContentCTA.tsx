import { Link } from 'react-router-dom';
import { Bell, Shield, Zap, Users } from 'lucide-react';

interface MidContentCTAProps {
  variant?: 'default' | 'govt' | 'resume';
}

export function MidContentCTA({ variant = 'default' }: MidContentCTAProps) {
  const configs = {
    default: {
      title: 'Get Instant Job Alerts',
      subtitle: 'Trusted by 10,000+ job seekers across India',
      cta: 'Sign Up Free',
      link: '/signup',
      benefits: ['Daily job alerts', 'AI resume builder', 'Application tracking'],
    },
    govt: {
      title: 'Never Miss a Sarkari Naukri',
      subtitle: 'Get notified for govt exams, admit cards & results',
      cta: 'Get Govt Job Alerts',
      link: '/signup',
      benefits: ['Exam date reminders', 'Admit card alerts', 'Result notifications'],
    },
    resume: {
      title: 'Build Your Resume for Free',
      subtitle: 'AI-powered resume builder with ATS optimization',
      cta: 'Build Resume Free',
      link: '/tools/resume-builder',
      benefits: ['ATS-optimized templates', 'AI content suggestions', 'Download as PDF'],
    },
  };

  const cfg = configs[variant];

  return (
    <section className="my-8 rounded-xl border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10 p-6 md:p-8">
      <div className="flex flex-col md:flex-row items-center gap-6">
        <div className="flex-1">
          <h3 className="text-xl font-bold text-foreground mb-1">{cfg.title}</h3>
          <p className="text-sm text-muted-foreground mb-3 flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" /> {cfg.subtitle}
          </p>
          <div className="flex flex-wrap gap-3">
            {cfg.benefits.map((b, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                <Zap className="h-3 w-3" /> {b}
              </span>
            ))}
          </div>
        </div>
        <Link
          to={cfg.link}
          className="shrink-0 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-base font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-md"
        >
          <Bell className="h-4 w-4" /> {cfg.cta}
        </Link>
      </div>
      <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1"><Shield className="h-3 w-3 text-green-500" /> Updated Daily</span>
        <span className="inline-flex items-center gap-1"><Users className="h-3 w-3 text-green-500" /> Trusted by 10,000+ Candidates</span>
      </div>
    </section>
  );
}
