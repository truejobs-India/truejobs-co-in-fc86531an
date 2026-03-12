import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

// Import category images
import categoryFreshers from '@/assets/category-freshers.png';
import categoryWfh from '@/assets/category-wfh.png';
import categoryParttime from '@/assets/category-parttime.jpg';
import categoryFulltime from '@/assets/category-fulltime.png';
import categoryWomen from '@/assets/category-women.png';
import categoryInternship from '@/assets/category-internship.jpg';

interface CategoryItem {
  labelKey: string;
  query: string;
  image: string;
  altKey: string;
  jobCount: string;
}

export function JobCategories() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const categories: CategoryItem[] = [
    {
      labelKey: 'categories.freshers',
      query: 'fresher',
      image: categoryFreshers,
      altKey: 'Young professional starting career in office setting',
      jobCount: '2.5K+',
    },
    {
      labelKey: 'categories.workFromHome',
      query: 'work from home',
      image: categoryWfh,
      altKey: 'Professional working remotely from home office',
      jobCount: '1.8K+',
    },
    {
      labelKey: 'categories.partTime',
      query: 'part time',
      image: categoryParttime,
      altKey: 'Employee working flexible part-time schedule',
      jobCount: '950+',
    },
    {
      labelKey: 'categories.fullTime',
      query: 'full time',
      image: categoryFulltime,
      altKey: 'Professional in full-time corporate role',
      jobCount: '4.2K+',
    },
    {
      labelKey: 'categories.forWomen',
      query: 'women',
      image: categoryWomen,
      altKey: 'Professional woman in workplace leadership role',
      jobCount: '1.5K+',
    },
    {
      labelKey: 'categories.internship',
      query: 'internship',
      image: categoryInternship,
      altKey: 'Intern gaining hands-on experience at company',
      jobCount: '780+',
    },
  ];

  return (
    <section className="py-12 md:py-16 lg:py-20 bg-muted/30 relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent/5 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 md:mb-10 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground">{t('categories.title')}</h2>
            <p className="text-muted-foreground mt-2 text-sm sm:text-base">{t('categories.subtitle')}</p>
          </motion.div>
          <Button variant="outline" className="hidden sm:flex border-primary/30 hover:bg-primary/10 hover:text-primary" asChild>
            <Link to="/jobs">
              {t('categories.viewAll')} <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {categories.map((category, index) => (
            <motion.div
              key={category.query}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05 }}
              className="group cursor-pointer"
              onClick={() => navigate(`/jobs?q=${encodeURIComponent(category.query)}`)}
            >
              <div className="card-premium rounded-2xl overflow-hidden h-full">
                <div className="aspect-[4/5] overflow-hidden relative">
                  <img 
                    src={category.image} 
                    alt={category.altKey}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/20 to-transparent" />
                  
                  {/* Content overlay */}
                  <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4">
                    <div className="text-xs text-white/80 font-medium mb-1">{category.jobCount} Jobs</div>
                    <h3 className="font-semibold text-sm sm:text-base text-white leading-tight flex items-center gap-1">
                      {t(category.labelKey)}
                      <ChevronRight className="h-4 w-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                    </h3>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Mobile CTA */}
        <div className="mt-6 text-center sm:hidden">
          <Button variant="outline" className="border-primary/30" asChild>
            <Link to="/jobs">
              {t('categories.viewAll')} <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
