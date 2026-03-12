import { useLanguage } from '@/contexts/LanguageContext';
import { motion } from 'framer-motion';
import { AnimatedCounter } from './AnimatedCounter';
import activeJobsIcon from '@/assets/icon-active-jobs.png';
import companiesIcon from '@/assets/icon-companies.png';
import jobSeekersIcon from '@/assets/icon-job-seekers.png';
import successRateIcon from '@/assets/icon-success-rate.png';

export function StatsSection() {
  const { t } = useLanguage();

  const stats = [
    { 
      customIcon: activeJobsIcon,
      value: 1000,
      suffix: '+',
      labelKey: 'stats.activeJobs',
      gradient: 'from-blue-500 to-cyan-500',
      bgColor: 'bg-blue-50',
    },
    { 
      customIcon: companiesIcon,
      value: 500,
      suffix: '+',
      labelKey: 'stats.companies',
      gradient: 'from-emerald-500 to-teal-500',
      bgColor: 'bg-emerald-50',
    },
    { 
      customIcon: jobSeekersIcon,
      value: 1000,
      suffix: '+',
      labelKey: 'stats.jobSeekers',
      gradient: 'from-amber-500 to-orange-500',
      bgColor: 'bg-amber-50',
    },
    { 
      customIcon: successRateIcon,
      value: 4.8,
      suffix: '★',
      labelKey: 'stats.userRating',
      gradient: 'from-rose-500 to-pink-500',
      bgColor: 'bg-rose-50',
    },
  ];

  return (
    <section className="py-12 md:py-16 bg-gradient-surface relative overflow-hidden">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-[0.02]" style={{
        backgroundImage: 'radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)',
        backgroundSize: '24px 24px'
      }} />

      <div className="container mx-auto px-4 relative z-10">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 lg:gap-8">
          {stats.map(({ customIcon, value, suffix, labelKey, gradient, bgColor }, index) => (
            <motion.div 
              key={labelKey} 
              className="group"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <div className="card-premium rounded-2xl p-4 sm:p-6 text-center">
                {/* Icon Circle */}
                <div className={`relative inline-flex items-center justify-center h-16 w-16 sm:h-20 sm:w-20 rounded-2xl ${bgColor} mb-4 transition-all duration-300 group-hover:scale-110 group-hover:shadow-medium overflow-hidden`}>
                  <img 
                    src={customIcon} 
                    alt="" 
                    className="h-10 w-10 sm:h-12 sm:w-12 object-contain transition-transform duration-300 group-hover:scale-110" 
                  />
                  {/* Subtle gradient overlay on hover */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
                </div>
                
                {/* Stat Value */}
                <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-1 tracking-tight">
                  <AnimatedCounter 
                    value={value} 
                    suffix={suffix} 
                    duration={2}
                  />
                </div>
                
                {/* Label */}
                <div className="text-xs sm:text-sm text-muted-foreground font-medium">
                  {t(labelKey)}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
