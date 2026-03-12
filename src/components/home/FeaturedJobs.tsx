import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin, Clock, IndianRupee, Building2, ArrowRight, Sparkles, Landmark } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export function FeaturedJobs() {
  const { t } = useLanguage();
  const [govtJobs, setGovtJobs] = useState<any[]>([]);
  const [privateJobs, setPrivateJobs] = useState<any[]>([]);
  const [govtCount, setGovtCount] = useState(0);
  const [privateCount, setPrivateCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchJobs() {
      const [govtRes, privateRes] = await Promise.all([
        supabase.from('jobs').select('id, title, slug, company_name, location, job_type, salary_min, salary_max, salary_currency, is_salary_visible, created_at, skills_required, company:companies(name, logo_url)', { count: 'exact' }).eq('status', 'active').eq('job_sector', 'government' as any).order('created_at', { ascending: false }).limit(4) as any,
        supabase.from('jobs').select('id, title, slug, company_name, location, job_type, salary_min, salary_max, salary_currency, is_salary_visible, created_at, skills_required, company:companies(name, logo_url)', { count: 'exact' }).eq('status', 'active').eq('job_sector', 'private' as any).order('created_at', { ascending: false }).limit(4) as any,
      ]);
      if (!govtRes.error) { setGovtJobs(govtRes.data || []); setGovtCount(govtRes.count || 0); }
      if (!privateRes.error) { setPrivateJobs(privateRes.data || []); setPrivateCount(privateRes.count || 0); }
      setIsLoading(false);
    }
    fetchJobs();
  }, []);

  const formatSalary = (min: number | null, max: number | null, currency: string) => {
    if (!min && !max) return t('featuredJobs.notDisclosed');
    const fmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency: currency || 'INR', maximumFractionDigits: 0 });
    if (min && max) return `${fmt.format(min)} - ${fmt.format(max)}`;
    if (min) return `${fmt.format(min)}+`;
    return `Up to ${fmt.format(max!)}`;
  };

  const JobCard = ({ job, index, icon: Icon }: { job: any; index: number; icon: any }) => (
    <motion.div key={job.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.05 }}>
      <Link to={`/jobs/${job.slug || job.id}`} className="card-premium rounded-2xl p-5 sm:p-6 h-full flex flex-col group block">
        <div className="flex items-start gap-3 mb-4">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center shrink-0">
            {job.company?.logo_url ? <img src={job.company.logo_url} alt="" className="h-8 w-8 object-contain" /> : <Icon className="h-6 w-6 text-primary" />}
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">{job.title}</h3>
            <p className="text-sm text-muted-foreground line-clamp-1">{job.company?.name || job.company_name || 'Company'}</p>
          </div>
        </div>
        <div className="space-y-2 mb-4 flex-1">
          <div className="flex items-center text-sm text-muted-foreground"><MapPin className="h-4 w-4 mr-2 shrink-0 text-primary/60" /><span className="line-clamp-1">{job.location || 'India'}</span></div>
          {job.is_salary_visible && <div className="flex items-center text-sm text-muted-foreground"><IndianRupee className="h-4 w-4 mr-2 shrink-0 text-primary/60" /><span>{formatSalary(job.salary_min, job.salary_max, job.salary_currency)}</span></div>}
          <div className="flex items-center text-sm text-muted-foreground"><Clock className="h-4 w-4 mr-2 shrink-0 text-primary/60" /><span>{formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}</span></div>
        </div>
        {job.skills_required?.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {job.skills_required.slice(0, 2).map((s: string) => <Badge key={s} variant="outline" className="text-xs">{s}</Badge>)}
          </div>
        )}
        <Button className="w-full bg-gradient-primary hover:opacity-90 shadow-primary text-sm">{t('featuredJobs.viewDetails')}</Button>
      </Link>
    </motion.div>
  );

  if (isLoading) {
    return (
      <section className="py-12 md:py-16 lg:py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-4 sm:gap-6 max-w-4xl mx-auto">
            {[...Array(4)].map((_, i) => <div key={i} className="card-premium rounded-2xl p-6"><Skeleton className="h-6 w-3/4 mb-3" /><Skeleton className="h-4 w-1/2 mb-4" /><Skeleton className="h-4 w-full mb-2" /><Skeleton className="h-4 w-2/3" /></div>)}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-12 md:py-16 lg:py-20 bg-gradient-to-b from-muted/30 to-background relative overflow-hidden">
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      <div className="container mx-auto px-4 relative z-10">
        {/* Government Jobs Section */}
        {govtJobs.length > 0 && (
          <div className="mb-14">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
              <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-8 w-8 rounded-lg bg-[hsl(25,95%,53%)] flex items-center justify-center shadow-sm"><Landmark className="h-4 w-4 text-white" /></div>
                  <span className="text-sm font-semibold text-[hsl(25,95%,40%)]">🇮🇳 Sarkari Jobs</span>
                  <Badge variant="secondary" className="text-xs">{govtCount}</Badge>
                </div>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground">Latest Government Jobs</h2>
              </motion.div>
              <Button variant="outline" className="hidden sm:flex border-primary/30 hover:bg-primary/10 hover:text-primary" asChild>
                <Link to="/sarkari-jobs">View All Govt Jobs <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </div>
            <div className="grid md:grid-cols-2 gap-4 sm:gap-6 max-w-4xl mx-auto">
              {govtJobs.map((job, i) => <JobCard key={job.id} job={job} index={i} icon={Landmark} />)}
            </div>
            <div className="mt-6 text-center sm:hidden">
              <Button variant="outline" className="border-primary/30" asChild><Link to="/sarkari-jobs">View All Govt Jobs <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
            </div>
          </div>
        )}

        {/* Private Jobs Section */}
        {privateJobs.length > 0 && (
          <div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
              <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-8 w-8 rounded-lg bg-gradient-primary flex items-center justify-center shadow-primary"><Sparkles className="h-4 w-4 text-primary-foreground" /></div>
                  <span className="text-sm font-semibold text-primary">Private Sector</span>
                  <Badge variant="secondary" className="text-xs">{privateCount}</Badge>
                </div>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground">Latest Private Jobs</h2>
              </motion.div>
              <Button variant="outline" className="hidden sm:flex border-primary/30 hover:bg-primary/10 hover:text-primary" asChild>
                <Link to="/private-jobs">View All Private Jobs <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </div>
            <div className="grid md:grid-cols-2 gap-4 sm:gap-6 max-w-4xl mx-auto">
              {privateJobs.map((job, i) => <JobCard key={job.id} job={job} index={i} icon={Building2} />)}
            </div>
            <div className="mt-6 text-center sm:hidden">
              <Button variant="outline" className="border-primary/30" asChild><Link to="/private-jobs">View All Private Jobs <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
