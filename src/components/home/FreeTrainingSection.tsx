import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { ArrowRight, GraduationCap, CheckCircle } from 'lucide-react';

// Import training image
import trainingHero from '@/assets/training-hero.jpg';

// Import premium icons
import iconBook from '@/assets/icon-book.png';
import iconVideo from '@/assets/icon-video.png';
import iconCheckmark from '@/assets/icon-checkmark.png';
import iconAward from '@/assets/icon-award.png';

export function FreeTrainingSection() {
  const { t } = useLanguage();

  const features = [
    { icon: iconBook, labelKey: 'training.feature1', altText: 'Expert courses book icon' },
    { icon: iconVideo, labelKey: 'training.feature2', altText: 'Video lessons play button icon' },
    { icon: iconAward, labelKey: 'training.feature3', altText: 'Certification award icon' },
  ];

  const benefitItems = [
    { 
      title: t('training.benefit1Title'), 
      desc: t('training.benefit1Desc'),
      icon: iconBook,
      altText: 'Learning courses book icon'
    },
    { 
      title: t('training.benefit2Title'), 
      desc: t('training.benefit2Desc'),
      icon: iconAward,
      altText: 'Career growth award icon'
    },
    { 
      title: t('training.benefit3Title'), 
      desc: t('training.benefit3Desc'),
      icon: iconVideo,
      altText: 'Industry experts video icon'
    },
  ];

  return (
    <section className="py-12 md:py-16 lg:py-20 bg-background relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Left - Content Card with Image */}
          <motion.div 
            className="relative"
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <div className="bg-gradient-primary rounded-2xl lg:rounded-3xl overflow-hidden relative shadow-elevated">
              {/* Background image with overlay */}
              <div className="absolute inset-0">
                <img 
                  src={trainingHero} 
                  alt="" 
                  className="w-full h-full object-cover opacity-20"
                />
              </div>
              
              {/* Decorative elements */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary-foreground/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
              
              <div className="relative z-10 p-6 sm:p-8 lg:p-10 text-primary-foreground">
                <div className="inline-flex items-center gap-2 glass-subtle px-4 py-2 rounded-full text-sm font-medium mb-6">
                  <GraduationCap className="h-4 w-4" />
                  {t('training.badge')}
                </div>

                <div className="mb-6">
                  <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-3">
                    {t('training.title')}
                  </h2>
                  <p className="text-primary-foreground/80 text-base sm:text-lg">
                    {t('training.subtitle')}
                  </p>
                </div>

                <div className="space-y-3 mb-8">
                  {features.map(({ icon, labelKey, altText }) => (
                    <div key={labelKey} className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-primary-foreground/20 flex items-center justify-center overflow-hidden">
                        <img 
                          src={icon} 
                          alt={altText}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <span className="font-medium text-sm sm:text-base">{t(labelKey)}</span>
                    </div>
                  ))}
                </div>

                <Button 
                  size="lg" 
                  className="bg-primary-foreground text-foreground hover:bg-primary-foreground/90 rounded-xl font-semibold shadow-medium"
                  asChild
                >
                  <Link to="/signup">
                    {t('training.cta')} <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              </div>
            </div>
          </motion.div>

          {/* Right - Info Cards */}
          <motion.div 
            className="space-y-6"
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <div className="space-y-2">
              <h3 className="text-xl sm:text-2xl font-bold text-foreground">{t('training.whyTitle')}</h3>
              <p className="text-muted-foreground text-sm sm:text-base">{t('training.whySubtitle')}</p>
            </div>

            <div className="grid gap-4">
              {benefitItems.map((item, i) => (
                <motion.div 
                  key={i}
                  className="card-premium rounded-2xl p-4 sm:p-5 flex items-start gap-4"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                >
                  <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-xl glass-strong shadow-soft flex items-center justify-center shrink-0 overflow-hidden">
                    <img 
                      src={item.icon} 
                      alt={item.altText}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-foreground mb-1 text-sm sm:text-base">{item.title}</h4>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                  </div>
                  <img src={iconCheckmark} alt="" className="h-5 w-5 sm:h-6 sm:w-6 object-contain shrink-0" />
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
