import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, MapPin, ArrowRight, Sparkles, Shield, Zap, Users } from 'lucide-react';

// Import images
import heroPerson from '@/assets/hero-person.png';
import logoTcs from '@/assets/logo-tcs-new.png';
import logoInfosys from '@/assets/logo-infosys-new.png';
import logoWipro from '@/assets/logo-wipro-new.png';
import logoTataAig from '@/assets/logo-tata-aig-new.png';
import logoHdfcLife from '@/assets/logo-hdfc-life.png';
import logoICICIPru from '@/assets/logo-icici-prudential.png';
import logoKotakLife from '@/assets/logo-kotak-life.png';
import logoBajaj from '@/assets/logo-bajaj.png';
import logoReliance from '@/assets/logo-reliance.png';
import iconCheckmark from '@/assets/icon-checkmark.png';

export function HeroSection() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [location, setLocation] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (location) params.set('location', location);
    navigate(`/jobs?${params.toString()}`);
  };

  const trustedLogos = [
    { name: 'TCS', logo: logoTcs, alt: 'TCS logo - Tata Consultancy Services' },
    { name: 'Infosys', logo: logoInfosys, alt: 'Infosys logo' },
    { name: 'Wipro', logo: logoWipro, alt: 'Wipro logo' },
    { name: 'Tata AIG', logo: logoTataAig, alt: 'Tata AIG Insurance logo' },
    { name: 'HDFC Life', logo: logoHdfcLife, alt: 'HDFC Life Insurance logo' },
    { name: 'ICICI Prudential', logo: logoICICIPru, alt: 'ICICI Prudential Life Insurance logo' },
    { name: 'Kotak Life', logo: logoKotakLife, alt: 'Kotak Life Insurance logo' },
    { name: 'Bajaj', logo: logoBajaj, alt: 'Bajaj Allianz logo' },
    { name: 'Reliance', logo: logoReliance, alt: 'Reliance Industries logo' },
  ];

  const trustIndicators = [
    { icon: Shield, label: t('hero.benefit1') },
    { icon: Zap, label: t('hero.benefit2') },
    { icon: Users, label: t('hero.benefit3') },
  ];

  return (
    <section className="relative overflow-hidden bg-animated-gradient">
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-40 w-80 h-80 bg-accent/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-primary/5 rounded-full blur-2xl" />
      </div>

      {/* Top gradient bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-primary" />

      <div className="container mx-auto px-4 py-8 sm:py-12 lg:py-20 relative z-10">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Left Content */}
          <motion.div 
            className="space-y-6 sm:space-y-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >

            <div className="space-y-4">
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-tight">
                {t('hero.title')}
                <span className="block text-gradient-primary">{t('hero.findDreamCareer')}</span>
              </h1>
              <p className="text-base sm:text-lg text-muted-foreground max-w-lg">
                {t('hero.subtitle')}
              </p>
            </div>

            {/* Search Form - Premium Glass Card */}
            <motion.form 
              onSubmit={handleSearch} 
              className="glass-strong rounded-2xl p-3 sm:p-4 shadow-elevated"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input
                    type="text"
                    placeholder={t('hero.search')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-12 h-12 sm:h-14 text-base bg-background/50 border-2 border-border/50 focus:border-primary focus:bg-background rounded-xl transition-all"
                  />
                </div>
                <div className="flex-1 relative group">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input
                    type="text"
                    placeholder={t('hero.location')}
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="pl-12 h-12 sm:h-14 text-base bg-background/50 border-2 border-border/50 focus:border-primary focus:bg-background rounded-xl transition-all"
                  />
                </div>
                <Button 
                  type="submit" 
                  size="lg" 
                  className="h-12 sm:h-14 px-6 sm:px-8 bg-gradient-primary hover:opacity-90 rounded-xl text-base font-semibold shadow-primary transition-all hover:shadow-primary-lg hover:scale-[1.02]"
                >
                  <span className="hidden sm:inline">{t('hero.find')}</span>
                  <span className="sm:hidden">Search</span>
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>

              {/* Quick Links */}
              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border/30">
                <span className="text-xs text-muted-foreground">Popular:</span>
                {['Software Engineer', 'Data Analyst', 'Product Manager', 'Sales Executive'].map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => setSearchQuery(term)}
                    className="text-xs px-3 py-1 rounded-full bg-secondary/80 hover:bg-primary/10 hover:text-primary transition-colors"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </motion.form>

            {/* Trust indicators */}
            <motion.div 
              className="flex flex-wrap gap-4 sm:gap-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              {trustIndicators.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <item.icon className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-sm font-medium text-foreground">{item.label}</span>
                </div>
              ))}
            </motion.div>

            {/* Trusted By - Company Logos */}
            <motion.div 
              className="pt-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <p className="text-sm font-medium text-muted-foreground mb-4">{t('hero.trustedBy')}</p>
              <div className="overflow-hidden">
                <motion.div 
                  className="flex items-center gap-4 sm:gap-6"
                  animate={{
                    x: [0, -100 * trustedLogos.length],
                  }}
                  transition={{
                    x: {
                      duration: trustedLogos.length * 4,
                      repeat: Infinity,
                      ease: "linear",
                    },
                  }}
                >
                  {[...trustedLogos, ...trustedLogos].map((company, index) => (
                    <div 
                      key={`${company.name}-${index}`}
                      className="flex-shrink-0 h-16 sm:h-20 w-28 sm:w-36 flex items-center justify-center glass rounded-xl p-3 hover:shadow-soft transition-all duration-300"
                      title={company.name}
                    >
                      <img 
                        src={company.logo} 
                        alt={company.alt}
                        className="h-full w-full object-contain"
                      />
                    </div>
                  ))}
                </motion.div>
              </div>
            </motion.div>
          </motion.div>

          {/* Right Content - Hero Image */}
          <motion.div 
            className="relative mt-8 lg:mt-0"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            {/* Decorative background */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-accent/10 to-transparent rounded-3xl blur-3xl" />
            
            {/* Main image card */}
            <div className="relative">
              <div className="glass-strong rounded-2xl lg:rounded-3xl overflow-hidden shadow-elevated mx-auto max-w-[320px] sm:max-w-sm md:max-w-md lg:max-w-none">
                <img 
                  src={heroPerson}
                  alt="Professional job seeker smiling confidently in an office environment"
                  className="w-full h-auto object-cover object-top max-h-[320px] sm:max-h-[380px] md:max-h-[440px] lg:max-h-[520px] xl:max-h-[600px]"
                />
                
                {/* Overlay stats - Glassmorphism */}
                <div className="absolute bottom-0 left-0 right-0 glass-strong p-3 sm:p-4 md:p-6 border-t border-white/20">
                    <div className="grid grid-cols-3 gap-2 md:gap-4 text-center">
                    <div className="group">
                      <div className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-foreground group-hover:text-primary transition-colors">1K+</div>
                      <div className="text-[9px] sm:text-[10px] md:text-xs text-muted-foreground font-medium">{t('stats.activeJobs')}</div>
                    </div>
                    <div className="group border-x border-border/30 px-2">
                      <div className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-foreground group-hover:text-primary transition-colors">500+</div>
                      <div className="text-[9px] sm:text-[10px] md:text-xs text-muted-foreground font-medium">{t('stats.companies')}</div>
                    </div>
                    <div className="group">
                      <div className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-foreground group-hover:text-primary transition-colors">4.8★</div>
                      <div className="text-[9px] sm:text-[10px] md:text-xs text-muted-foreground font-medium">User Rating</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating badge - Premium */}
              <motion.div 
                className="absolute -top-2 -right-2 sm:-top-3 sm:-right-3 md:-top-4 md:-right-4 glass-strong px-3 py-1.5 sm:px-4 sm:py-2 rounded-full shadow-elevated flex items-center gap-2"
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <span className="text-[10px] sm:text-xs md:text-sm font-semibold text-foreground whitespace-nowrap">
                  {t('hero.newJobsToday')}
                </span>
              </motion.div>

              {/* Additional floating element */}
              <motion.div 
                className="absolute bottom-1/4 -left-4 sm:-left-6 hidden md:flex glass-strong px-3 py-2 rounded-xl shadow-medium items-center gap-2"
                animate={{ x: [0, 5, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              >
                <div className="h-8 w-8 rounded-lg bg-gradient-primary flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-foreground">AI Matching</div>
                  <div className="text-[10px] text-muted-foreground">Smart recommendations</div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
