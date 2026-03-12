import { useLanguage } from '@/contexts/LanguageContext';
import { motion } from 'framer-motion';

// Import premium icons
import iconRegister from '@/assets/icon-register.png';
import iconSearchJobs from '@/assets/icon-search-jobs.png';
import iconApply from '@/assets/icon-apply.png';
import iconHired from '@/assets/icon-hired.png';

export function HowItWorks() {
  const { t } = useLanguage();

  const steps = [
    {
      icon: iconRegister,
      titleKey: 'howItWorks.step1.title',
      descKey: 'howItWorks.step1.desc',
      altText: 'Create your profile icon',
      gradient: 'from-blue-500 to-cyan-500',
    },
    {
      icon: iconSearchJobs,
      titleKey: 'howItWorks.step2.title',
      descKey: 'howItWorks.step2.desc',
      altText: 'Search for jobs icon',
      gradient: 'from-emerald-500 to-teal-500',
    },
    {
      icon: iconApply,
      titleKey: 'howItWorks.step3.title',
      descKey: 'howItWorks.step3.desc',
      altText: 'Apply to jobs icon',
      gradient: 'from-amber-500 to-orange-500',
    },
    {
      icon: iconHired,
      titleKey: 'howItWorks.step4.title',
      descKey: 'howItWorks.step4.desc',
      altText: 'Get hired success icon',
      gradient: 'from-rose-500 to-pink-500',
    },
  ];

  return (
    <section className="py-12 md:py-16 lg:py-20 bg-gradient-surface relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute top-1/2 left-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 -translate-x-1/2" />
      <div className="absolute bottom-0 right-0 w-64 h-64 bg-accent/5 rounded-full blur-2xl translate-y-1/2 translate-x-1/2" />

      <div className="container mx-auto px-4 relative z-10">
        <motion.div 
          className="text-center mb-10 md:mb-14"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-3">{t('howItWorks.title')}</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-sm sm:text-base">
            {t('howItWorks.subtitle')}
          </p>
        </motion.div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {steps.map((step, index) => (
            <motion.div 
              key={step.titleKey} 
              className="relative group"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              {/* Connection line - Desktop only */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-14 left-[60%] w-full">
                  <div className="h-0.5 bg-gradient-to-r from-primary/40 to-transparent" />
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-primary/20" />
                </div>
              )}
              
              <div className="text-center relative z-10">
                {/* Icon Container */}
                <div className="inline-flex items-center justify-center h-20 w-20 sm:h-24 sm:w-24 rounded-2xl glass-strong mb-4 relative group-hover:scale-105 transition-all duration-300 shadow-soft group-hover:shadow-medium overflow-hidden">
                  <img 
                    src={step.icon} 
                    alt={step.altText}
                    className="h-full w-full object-cover"
                  />
                  {/* Step number */}
                  <span className={`absolute -top-1 -right-1 sm:-top-2 sm:-right-2 h-6 w-6 sm:h-8 sm:w-8 rounded-full bg-gradient-to-br ${step.gradient} text-primary-foreground flex items-center justify-center text-xs sm:text-sm font-bold shadow-medium`}>
                    {index + 1}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-semibold text-foreground mb-2">{t(step.titleKey)}</h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{t(step.descKey)}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
