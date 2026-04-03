import { Link } from 'react-router-dom';
import { CreditCard, Award, Calendar, FileCheck, UserCheck, Bell } from 'lucide-react';

const ITEMS = [
  { label: 'Admit Cards', icon: CreditCard, href: '/sarkari-jobs?status=admit_card_released', color: 'text-blue-600 bg-blue-50' },
  { label: 'Results', icon: Award, href: '/sarkari-jobs?status=result_declared', color: 'text-green-600 bg-green-50' },
  { label: 'Exam Calendar', icon: Calendar, href: '/sarkari-jobs', color: 'text-purple-600 bg-purple-50' },
  { label: 'Answer Keys', icon: FileCheck, href: '/sarkari-jobs', color: 'text-orange-600 bg-orange-50' },
  { label: 'Notifications', icon: Bell, href: '/notifications', color: 'text-red-600 bg-red-50' },
  { label: 'Eligibility', icon: UserCheck, href: '/sarkari-jobs', color: 'text-teal-600 bg-teal-50' },
];

export function QuickAccessBar() {
  return (
    <section className="py-6">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {ITEMS.map(item => (
            <Link
              key={item.label}
              to={item.href}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-card border border-border hover:shadow-md transition-all text-center group"
            >
              <div className={`p-3 rounded-lg ${item.color} group-hover:scale-110 transition-transform`}>
                <item.icon className="h-5 w-5" />
              </div>
              <span className="text-xs font-medium text-foreground">{item.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
