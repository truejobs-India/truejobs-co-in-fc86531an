import { Link } from 'react-router-dom';

import stateAP from '@/assets/state-ap.png';
import stateBihar from '@/assets/state-bihar.png';
import stateDelhi from '@/assets/state-delhi.png';
import stateGujarat from '@/assets/state-gujarat.png';
import stateHaryana from '@/assets/state-haryana.png';
import stateKarnataka from '@/assets/state-karnataka.png';
import stateMP from '@/assets/state-mp.png';
import stateMaharashtra from '@/assets/state-maharashtra.png';
import stateOdisha from '@/assets/state-odisha.png';
import statePunjab from '@/assets/state-punjab.png';
import stateRajasthan from '@/assets/state-rajasthan.png';
import stateTN from '@/assets/state-tn.png';
import stateTelangana from '@/assets/state-telangana.png';
import stateUP from '@/assets/state-up.png';
import stateWB from '@/assets/state-wb.png';
import stateAll from '@/assets/state-all.png';

const STATES = [
  { name: 'Andhra Pradesh', slug: 'govt-jobs-andhra-pradesh', img: stateAP },
  { name: 'Bihar', slug: 'govt-jobs-bihar', img: stateBihar },
  { name: 'Delhi', slug: 'govt-jobs-delhi', img: stateDelhi },
  { name: 'Gujarat', slug: 'govt-jobs-gujarat', img: stateGujarat },
  { name: 'Haryana', slug: 'govt-jobs-haryana', img: stateHaryana },
  { name: 'Karnataka', slug: 'govt-jobs-karnataka', img: stateKarnataka },
  { name: 'Madhya Pradesh', slug: 'govt-jobs-madhya-pradesh', img: stateMP },
  { name: 'Maharashtra', slug: 'govt-jobs-maharashtra', img: stateMaharashtra },
  { name: 'Odisha', slug: 'govt-jobs-odisha', img: stateOdisha },
  { name: 'Punjab', slug: 'govt-jobs-punjab', img: statePunjab },
  { name: 'Rajasthan', slug: 'govt-jobs-rajasthan', img: stateRajasthan },
  { name: 'Tamil Nadu', slug: 'govt-jobs-tamil-nadu', img: stateTN },
  { name: 'Telangana', slug: 'govt-jobs-telangana', img: stateTelangana },
  { name: 'Uttar Pradesh', slug: 'govt-jobs-uttar-pradesh', img: stateUP },
  { name: 'West Bengal', slug: 'govt-jobs-west-bengal', img: stateWB },
  { name: 'All States', slug: 'sarkari-jobs', img: stateAll },
];

export function StateQuickFilter() {
  return (
    <section className="py-6">
      <div className="container mx-auto px-4">
        <div className="mb-4">
          <h2 className="text-xl md:text-2xl font-bold text-foreground font-['Outfit',sans-serif]">Government Jobs by State</h2>
          <p className="text-muted-foreground text-sm mt-1">Fast access to state-wise vacancies</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {STATES.map(s => (
            <Link
              key={s.slug}
              to={`/${s.slug}`}
              className="flex flex-col items-center gap-2 rounded-2xl bg-card border border-border hover:shadow-medium transition-all text-center group overflow-hidden"
            >
              <div className="w-full aspect-square overflow-hidden bg-secondary/30 group-hover:scale-105 transition-transform">
                <img src={s.img} alt={s.name} className="w-full h-full object-cover" />
              </div>
              <span className="text-sm font-semibold text-foreground pb-3 px-2">{s.name}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
