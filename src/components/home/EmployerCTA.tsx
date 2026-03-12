import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { ArrowRight, Sparkles, CheckCircle } from 'lucide-react';

// Import employer CTA image
import employerCtaImage from '@/assets/employer-cta.jpg';

// Import premium icons
import iconTeam from '@/assets/icon-team.png';
import iconSpeed from '@/assets/icon-speed.png';
import iconShield from '@/assets/icon-shield.png';

export function EmployerCTA() {
  const { t } = useLanguage();

  const benefits = [
    { icon: iconTeam, labelKey: 'employerCTA.benefit1', altText: 'Team of candidates icon' },
    { icon: iconSpeed, labelKey: 'employerCTA.benefit2', altText: 'Fast hiring speed icon' },
    { icon: iconShield, labelKey: 'employerCTA.benefit3', altText: 'Verified candidates shield icon' },
  ];

  return (
    <section className="relative overflow-hidden">
      {/* Background image with overlay */}
      <div className="absolute inset-0">
        <img 
          src={employerCtaImage} 
          alt="Diverse hiring team collaborating in a modern office" 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-foreground/95 via-foreground/90 to-primary/80" />
      </div>

      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 py-16 md:py-20 lg:py-24 relative z-10">
        <div className="max-w-4xl mx-auto text-center text-primary-foreground">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="inline-flex items-center gap-2 glass-subtle px-4 py-2 rounded-full text-sm font-medium mb-6">
              <Sparkles className="h-4 w-4" />
              {t('employerCTA.badge')}
            </div>
            
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6 leading-tight">
              {t('employerCTA.title')}
            </h2>
            <p className="text-base sm:text-lg text-primary-foreground/80 mb-8 max-w-2xl mx-auto">
              {t('employerCTA.subtitle')}
            </p>
          </motion.div>

          <motion.div 
            className="flex flex-wrap justify-center gap-4 sm:gap-6 mb-10"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
          >
            {benefits.map(({ icon, labelKey, altText }) => (
              <div key={labelKey} className="flex items-center gap-2 sm:gap-3 glass-subtle rounded-full px-4 py-2">
                <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-primary-foreground/20 flex items-center justify-center overflow-hidden">
                  <img 
                    src={icon} 
                    alt={altText}
                    className="h-full w-full object-cover"
                  />
                </div>
                <span className="text-sm font-medium">{t(labelKey)}</span>
              </div>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            <Button 
              size="lg" 
              className="bg-primary-foreground text-foreground hover:bg-primary-foreground/90 rounded-xl px-8 py-6 text-base sm:text-lg font-semibold shadow-elevated hover:shadow-primary-lg transition-all hover:scale-[1.02]"
              asChild
            >
              <Link to="/signup">
                {t('employerCTA.cta')} <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
