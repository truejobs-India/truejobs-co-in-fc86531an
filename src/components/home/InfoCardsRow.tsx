import { Link } from 'react-router-dom';

import infoResults from '@/assets/info-results.png';
import infoAdmitCard from '@/assets/info-admit-card.png';
import infoExamCalendar from '@/assets/info-exam-calendar.png';

const CARDS = [
  {
    title: 'Sarkari Results',
    desc: 'Check latest exam and recruitment results quickly.',
    img: infoResults,
    href: '/sarkari-jobs?status=result_declared',
  },
  {
    title: 'Admit Cards',
    desc: 'Download hall tickets and admit cards from one place.',
    img: infoAdmitCard,
    href: '/sarkari-jobs?status=admit_card_released',
  },
  {
    title: 'Exam Calendar',
    desc: 'Track upcoming recruitment dates and important deadlines.',
    img: infoExamCalendar,
    href: '/sarkari-jobs',
  },
];

export function InfoCardsRow() {
  return (
    <section className="py-6">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {CARDS.map(card => (
            <Link
              key={card.title}
              to={card.href}
              className="flex flex-col items-center rounded-2xl bg-card border border-border hover:shadow-medium transition-all group overflow-hidden"
            >
              <div className="w-full aspect-square overflow-hidden bg-secondary/30 group-hover:scale-105 transition-transform">
                <img src={card.img} alt={card.title} className="w-full h-full object-cover" />
              </div>
              <div className="p-4 text-center">
                <h3 className="text-lg font-bold text-foreground mb-1 font-['Outfit',sans-serif]">{card.title}</h3>
                <p className="text-muted-foreground text-sm">{card.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
