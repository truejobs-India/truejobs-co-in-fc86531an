import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { ChevronRight, TrendingUp, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

// Import premium icons
import iconSalesMarketing from '@/assets/icon-sales-marketing.png';
import iconOperations from '@/assets/icon-operations.png';
import iconFinance from '@/assets/icon-finance.png';
import iconItCreative from '@/assets/icon-it-creative.png';
import iconEducation from '@/assets/icon-education.png';

interface RoleCategory {
  titleKey: string;
  icon: string;
  altText: string;
  roles: { title: string; query: string }[];
}

const ROLE_CATEGORIES: RoleCategory[] = [
  {
    titleKey: 'trendingRoles.salesMarketing',
    icon: iconSalesMarketing,
    altText: 'Sales and marketing growth chart icon',
    roles: [
      { title: 'Field Sales', query: 'field sales' },
      { title: 'Sales Executive', query: 'sales executive' },
      { title: 'Telecalling/BPO', query: 'telecalling bpo' },
    ],
  },
  {
    titleKey: 'trendingRoles.operationsDelivery',
    icon: iconOperations,
    altText: 'Operations and delivery truck icon',
    roles: [
      { title: 'Delivery Partner', query: 'delivery partner' },
      { title: 'Back Office', query: 'back office' },
      { title: 'Data Entry', query: 'data entry' },
    ],
  },
  {
    titleKey: 'trendingRoles.financeHR',
    icon: iconFinance,
    altText: 'Finance calculator icon',
    roles: [
      { title: 'Accountant', query: 'accountant' },
      { title: 'HR Executive', query: 'hr executive' },
      { title: 'Receptionist', query: 'receptionist' },
    ],
  },
  {
    titleKey: 'trendingRoles.itCreative',
    icon: iconItCreative,
    altText: 'IT and creative laptop icon',
    roles: [
      { title: 'Graphic Designer', query: 'graphic designer' },
      { title: 'Content Writer', query: 'content writer' },
    ],
  },
  {
    titleKey: 'trendingRoles.education',
    icon: iconEducation,
    altText: 'Education graduation cap icon',
    roles: [
      { title: 'Teacher', query: 'teacher' },
    ],
  },
];

export function TrendingRoles() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  return (
    <section className="py-12 md:py-16 lg:py-20 bg-background relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />

      <div className="container mx-auto px-4 relative z-10">
        {/* Header */}
        <motion.div 
          className="mb-8 md:mb-10"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium mb-2">
            <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center">
              <TrendingUp className="h-3.5 w-3.5 text-primary" />
            </div>
            <span>{t('trendingRoles.badge')}</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground">
                {t('trendingRoles.title')}
              </h2>
              <p className="text-muted-foreground mt-2 text-sm sm:text-base">
                {t('trendingRoles.subtitle')}
              </p>
            </div>
            <Button variant="outline" className="hidden sm:flex border-primary/30 hover:bg-primary/10 hover:text-primary" asChild>
              <Link to="/jobs">
                {t('trendingRoles.viewAll')} <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </motion.div>

        {/* Role Categories Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6">
          {ROLE_CATEGORIES.map((category, catIndex) => (
            <motion.div 
              key={category.titleKey} 
              className="card-premium rounded-2xl p-4 sm:p-5"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: catIndex * 0.05 }}
            >
              {/* Category Header */}
              <div className="flex items-center gap-2 pb-3 mb-3 border-b border-border">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center overflow-hidden">
                  <img 
                    src={category.icon} 
                    alt={category.altText}
                    className="h-full w-full object-cover"
                  />
                </div>
                <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide line-clamp-1">
                  {t(category.titleKey)}
                </h3>
              </div>

              {/* Role Links */}
              <ul className="space-y-1">
                {category.roles.map((role) => (
                  <li key={role.title}>
                    <button
                      onClick={() => navigate(`/jobs?q=${encodeURIComponent(role.query)}`)}
                      className="group w-full text-left px-2 py-2 rounded-lg text-sm text-muted-foreground hover:bg-primary/5 hover:text-primary transition-colors flex items-center justify-between"
                    >
                      <span className="line-clamp-1">{role.title}</span>
                      <ChevronRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-primary shrink-0" />
                    </button>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        {/* Mobile CTA */}
        <div className="mt-6 text-center sm:hidden">
          <Button variant="outline" className="border-primary/30" asChild>
            <Link to="/jobs">
              {t('trendingRoles.viewAll')} <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
