import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Building2, ArrowRight, MapPin, Briefcase } from 'lucide-react';

interface Company {
  id: string;
  name: string;
  logo_url: string | null;
  industry: string | null;
  location: string | null;
  job_count?: number;
}

export function TopCompanies() {
  const { t } = useLanguage();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchTopCompanies() {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name, logo_url, industry, location')
        .eq('is_approved', true)
        .limit(6);

      if (!error && data) {
        setCompanies(data);
      }
      setIsLoading(false);
    }

    fetchTopCompanies();
  }, []);

  if (isLoading) {
    return (
      <section className="py-12 md:py-16 lg:py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold">{t('topCompanies.title')}</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="card-premium rounded-2xl p-6">
                <Skeleton className="h-16 w-16 mx-auto mb-4 rounded-xl" />
                <Skeleton className="h-4 w-3/4 mx-auto mb-2" />
                <Skeleton className="h-3 w-1/2 mx-auto" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (companies.length === 0) {
    return null;
  }

  return (
    <section className="py-12 md:py-16 lg:py-20 bg-background relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute top-1/2 left-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 -translate-x-1/2" />
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 md:mb-10 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground">{t('topCompanies.title')}</h2>
            <p className="text-muted-foreground mt-2 text-sm sm:text-base">{t('topCompanies.subtitle')}</p>
          </motion.div>
          <Button variant="outline" className="hidden md:flex border-primary/30 hover:bg-primary/10 hover:text-primary" asChild>
            <Link to="/companies">
              {t('topCompanies.viewAll')} <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {companies.map((company, index) => (
            <motion.div
              key={company.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05 }}
            >
              <Link 
                to={`/companies?q=${encodeURIComponent(company.name)}`}
                className="block card-premium rounded-2xl p-4 sm:p-6 text-center group h-full"
              >
                <div className="h-14 w-14 sm:h-16 sm:w-16 mx-auto mb-3 sm:mb-4 rounded-xl bg-muted flex items-center justify-center overflow-hidden transition-all duration-300 group-hover:shadow-medium group-hover:scale-105">
                  {company.logo_url ? (
                    <img 
                      src={company.logo_url} 
                      alt={`${company.name} logo`}
                      className="h-10 w-10 sm:h-12 sm:w-12 object-contain"
                    />
                  ) : (
                    <Building2 className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground" />
                  )}
                </div>
                <h3 className="font-semibold text-sm mb-1 line-clamp-1 group-hover:text-primary transition-colors">
                  {company.name}
                </h3>
                {company.industry && (
                  <p className="text-xs text-muted-foreground line-clamp-1 mb-2">
                    {company.industry}
                  </p>
                )}
                <span className="inline-flex items-center gap-1 text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                  View Jobs <ArrowRight className="h-3 w-3" />
                </span>
              </Link>
            </motion.div>
          ))}
        </div>

        <div className="mt-6 text-center md:hidden">
          <Button variant="outline" className="border-primary/30" asChild>
            <Link to="/companies">
              {t('topCompanies.viewAll')} <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
