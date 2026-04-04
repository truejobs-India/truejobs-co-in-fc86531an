import { Link } from 'react-router-dom';
import { Calculator, Calendar, Keyboard, UserCheck, IndianRupee, Camera, ImageIcon, FileText, Percent, Target } from 'lucide-react';

const TOOLS = [
  { label: 'Age Calculator', href: '/govt-job-age-calculator', icon: Calculator },
  { label: 'Eligibility Checker', href: '/govt-exam-eligibility-checker', icon: UserCheck },
  { label: 'Salary Calculator', href: '/govt-salary-calculator', icon: IndianRupee },
  { label: 'Typing Test', href: '/typing-test-for-government-exams', icon: Keyboard },
  { label: 'Exam Calendar', href: '/govt-exam-calendar', icon: Calendar },
  { label: 'Photo Resizer', href: '/photo-resizer', icon: Camera },
  { label: 'Image Resizer', href: '/image-resizer', icon: ImageIcon },
  { label: 'PDF Tools', href: '/pdf-tools', icon: FileText },
  { label: 'Percentage Calculator', href: '/percentage-calculator', icon: Percent },
  { label: 'Fee Calculator', href: '/govt-exam-fee-calculator', icon: IndianRupee },
  { label: 'AI Resume Checker', href: '/tools/resume-checker', icon: Target },
];

export function PrepToolsBanner() {
  return (
    <section className="py-6">
      <div className="container mx-auto px-4">
        <div className="rounded-3xl bg-[hsl(25,95%,50%)] p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-5 text-white">
          <div className="shrink-0">
            <h2 className="text-xl md:text-2xl font-bold mb-2 font-['Outfit',sans-serif]">
              Preparation Tools & Career Help
            </h2>
            <p className="text-white/90 text-sm">
              Free tools for exam prep, eligibility, salary calculation, and career support.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {TOOLS.map(t => (
              <Link
                key={t.label}
                to={t.href}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/[0.15] text-white border border-white/[0.2] text-xs font-medium hover:bg-white/30 transition-colors"
              >
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
              </Link>
            ))}
            <Link
              to="/tools"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white text-[hsl(25,95%,40%)] text-xs font-bold hover:bg-white/90 transition-colors"
            >
              View All Tools →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
