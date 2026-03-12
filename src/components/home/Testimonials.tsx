import { useLanguage } from '@/contexts/LanguageContext';
import { motion } from 'framer-motion';
import { Users, Building2, Award, Quote } from 'lucide-react';

// Import testimonial images
import testimonial1 from '@/assets/testimonial-1.jpg';
import testimonial2 from '@/assets/testimonial-2.jpg';
import testimonial3 from '@/assets/testimonial-3.jpg';

// Import premium icon
import iconCheckmark from '@/assets/icon-checkmark.png';

// Import company logos for trust badges
import logoTCS from '@/assets/logo-tcs-new.png';
import logoInfosys from '@/assets/logo-infosys-new.png';
import logoWipro from '@/assets/logo-wipro-new.png';
import logoTataAIG from '@/assets/logo-tata-aig-new.png';
import logoHDFCLife from '@/assets/logo-hdfc-life.png';
import logoICICIPru from '@/assets/logo-icici-prudential.png';
import logoKotakLife from '@/assets/logo-kotak-life.png';
import logoBajaj from '@/assets/logo-bajaj.png';
import logoReliance from '@/assets/logo-reliance.png';

interface Testimonial {
  name: string;
  role: string;
  company: string;
  type: 'candidate' | 'employer';
  textKey: string;
  avatar: string;
  location: string;
}

const TESTIMONIALS: Testimonial[] = [
  {
    name: 'Priya Sharma',
    role: 'Software Developer',
    company: 'TechCorp India',
    type: 'candidate',
    textKey: 'testimonials.text1',
    avatar: testimonial1,
    location: 'Bengaluru',
  },
  {
    name: 'Amit Verma',
    role: 'HR Manager',
    company: 'FinServe India',
    type: 'employer',
    textKey: 'testimonials.textEmployer',
    avatar: testimonial2,
    location: 'Mumbai',
  },
  {
    name: 'Rahul Gupta',
    role: 'B.Tech Graduate',
    company: 'Fresher',
    type: 'candidate',
    textKey: 'testimonials.text3',
    avatar: testimonial3,
    location: 'Delhi NCR',
  },
];

const TRUST_LOGOS = [
  { src: logoTCS, alt: 'TCS logo - Tata Consultancy Services' },
  { src: logoInfosys, alt: 'Infosys logo' },
  { src: logoWipro, alt: 'Wipro logo' },
  { src: logoTataAIG, alt: 'Tata AIG Insurance logo' },
  { src: logoHDFCLife, alt: 'HDFC Life Insurance logo' },
  { src: logoICICIPru, alt: 'ICICI Prudential Life Insurance logo' },
  { src: logoKotakLife, alt: 'Kotak Life Insurance logo' },
  { src: logoBajaj, alt: 'Bajaj Allianz logo' },
  { src: logoReliance, alt: 'Reliance Industries logo' },
];

const STATS = [
  { key: 'placements', value: '1K+', icon: Users, gradient: 'from-blue-500 to-cyan-500' },
  { key: 'employers', value: '500+', icon: Building2, gradient: 'from-emerald-500 to-teal-500' },
  { key: 'rating', value: '4.8/5', icon: Award, gradient: 'from-amber-500 to-orange-500' },
];

export function Testimonials() {
  const { t } = useLanguage();

  return (
    <section className="py-12 md:py-16 lg:py-20 bg-background relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-accent/5 rounded-full blur-2xl" />

      <div className="container mx-auto px-4 relative z-10">
        {/* Section Header */}
        <motion.div 
          className="text-center mb-10 md:mb-14"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-3">
            {t('testimonials.title')}
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base max-w-2xl mx-auto">
            {t('testimonials.subtitle')}
          </p>
        </motion.div>

        {/* Stats Row - Premium Trust Indicators */}
        <motion.div 
          className="flex flex-wrap items-center justify-center gap-4 sm:gap-8 md:gap-12 mb-12 md:mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
        >
          {STATS.map((stat, index) => (
            <div key={index} className="flex items-center gap-3 glass rounded-xl px-4 py-3 shadow-soft">
              <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${stat.gradient} flex items-center justify-center`}>
                <stat.icon className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <span className="text-xl sm:text-2xl font-bold text-foreground">{stat.value}</span>
                <span className="text-xs sm:text-sm text-muted-foreground ml-1.5">{t(`testimonials.stat.${stat.key}`)}</span>
              </div>
            </div>
          ))}
        </motion.div>

        {/* Testimonial Cards Grid */}
        <div className="grid md:grid-cols-3 gap-4 sm:gap-6 max-w-5xl mx-auto">
          {TESTIMONIALS.map((testimonial, index) => (
            <motion.div 
              key={index}
              className="card-premium rounded-2xl p-5 sm:p-6 relative"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              {/* Quote icon */}
              <Quote className="absolute top-4 right-4 h-8 w-8 text-primary/10" />

              {/* Type Badge */}
              <div className="flex items-center gap-2 mb-4">
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                  testimonial.type === 'employer' 
                    ? 'bg-primary/10 text-primary' 
                    : 'bg-emerald-100 text-emerald-700'
                }`}>
                  {testimonial.type === 'employer' 
                    ? t('testimonials.employer') 
                    : t('testimonials.candidate')}
                </span>
                <span className="text-xs text-muted-foreground">{testimonial.location}</span>
              </div>
              
              {/* Quote Text */}
              <p className="text-muted-foreground text-sm leading-relaxed mb-5">
                "{t(testimonial.textKey)}"
              </p>
              
              {/* Author */}
              <div className="flex items-center gap-3 pt-4 border-t border-border">
                <img 
                  src={testimonial.avatar} 
                  alt={`${testimonial.name}, ${testimonial.role} at ${testimonial.company}`}
                  className="h-11 w-11 rounded-full object-cover border-2 border-primary/20"
                />
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-foreground">
                    {testimonial.name}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    {testimonial.role}{testimonial.company !== 'Fresher' ? `, ${testimonial.company}` : ''}
                  </p>
                </div>
                <img src={iconCheckmark} alt="Verified testimonial" className="h-5 w-5 object-contain shrink-0" />
              </div>
            </motion.div>
          ))}
        </div>

        {/* Trust Logos - Auto Scrolling */}
        <motion.div 
          className="mt-14 md:mt-16 pt-10 border-t border-border"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          <p className="text-center text-xs text-muted-foreground uppercase tracking-widest font-medium mb-8">
            {t('testimonials.trustedBy')}
          </p>
          <div className="overflow-hidden">
            <motion.div 
              className="flex items-center gap-8 sm:gap-12"
              animate={{
                x: [0, -160 * TRUST_LOGOS.length],
              }}
              transition={{
                x: {
                  duration: TRUST_LOGOS.length * 3,
                  repeat: Infinity,
                  ease: "linear",
                },
              }}
            >
              {/* Duplicate logos for seamless scroll */}
              {[...TRUST_LOGOS, ...TRUST_LOGOS].map((logo, index) => (
                <div 
                  key={index}
                  className="flex-shrink-0 flex items-center justify-center h-14 sm:h-16 md:h-20 px-4 sm:px-6 glass rounded-xl"
                >
                  <img 
                    src={logo.src} 
                    alt={logo.alt}
                    className="h-10 sm:h-12 md:h-14 w-auto max-w-[140px] sm:max-w-[180px] object-contain"
                  />
                </div>
              ))}
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
