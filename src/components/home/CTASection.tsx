import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight, Sparkles, Briefcase, Building2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

// Import premium icons
import iconJobSeeker from '@/assets/icon-job-seeker.png';
import iconEmployer from '@/assets/icon-employer.png';

export function CTASection() {
  const { t } = useLanguage();

  const ctaCards = [
    {
      icon: iconJobSeeker,
      iconFallback: Briefcase,
      titleKey: 'cta.lookingForJob',
      descKey: 'cta.jobSeekerDesc',
      buttonKey: 'cta.getStartedFree',
      link: '/signup',
      gradient: 'from-blue-500 to-cyan-500',
      hasSparkle: true,
    },
    {
      icon: iconEmployer,
      iconFallback: Building2,
      titleKey: 'cta.lookingToHire',
      descKey: 'cta.employerDesc',
      buttonKey: 'cta.postJob',
      link: '/signup',
      gradient: 'from-emerald-500 to-teal-500',
      hasSparkle: false,
    },
  ];

  return (
    <section className="py-12 md:py-16 lg:py-20 bg-gradient-primary text-primary-foreground relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary-foreground/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary-foreground/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary-foreground/5 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="grid md:grid-cols-2 gap-6 md:gap-8 lg:gap-12">
          {ctaCards.map((card, index) => (
            <motion.div 
              key={card.titleKey}
              className="glass-subtle rounded-2xl p-6 sm:p-8 text-center md:text-left"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <div className="inline-flex items-center justify-center h-16 w-16 sm:h-20 sm:w-20 rounded-2xl bg-primary-foreground/20 backdrop-blur mb-4 sm:mb-6 shadow-medium overflow-hidden">
                <img 
                  src={card.icon} 
                  alt="" 
                  className="h-full w-full object-cover"
                />
              </div>
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-3 sm:mb-4">{t(card.titleKey)}</h2>
              <p className="text-primary-foreground/80 mb-6 max-w-md text-sm sm:text-base">
                {t(card.descKey)}
              </p>
              <Button 
                size="lg" 
                className="bg-primary-foreground text-foreground hover:bg-primary-foreground/90 shadow-medium rounded-xl px-6 sm:px-8 text-sm sm:text-base font-semibold" 
                asChild
              >
                <Link to={card.link}>
                  {card.hasSparkle && <Sparkles className="mr-2 h-4 w-4" />}
                  {t(card.buttonKey)} <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
