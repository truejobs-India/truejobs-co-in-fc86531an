import { Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { AdPlaceholder } from '@/components/ads/AdPlaceholder';
import { SEO } from '@/components/SEO';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Briefcase, Users, Sparkles, Target, Heart, Shield, 
  Zap, Globe, Award, TrendingUp, CheckCircle, Lightbulb,
  GraduationCap, Building2, ArrowRight, BookOpen, Bot
} from 'lucide-react';
import { MSMECredibility } from '@/components/MSMECredibility';

export default function About() {
  const stats = [
    { label: 'Active Job Listings', value: '1,000+', icon: Briefcase },
    { label: 'Registered Job Seekers', value: '1,000+', icon: Users },
    { label: 'Partner Companies', value: '500+', icon: Globe },
    { label: 'Successful Connections', value: '500+', icon: Award },
  ];

  const values = [
    {
      icon: Target,
      title: 'Mission-Driven',
      description: 'We exist to bridge the gap between talented individuals and meaningful employment opportunities across India, especially in underserved Tier-2 and Tier-3 cities.',
    },
    {
      icon: Sparkles,
      title: 'AI-Powered Innovation',
      description: 'Our proprietary AI matching engine analyzes skills, experience, location preferences, and career goals to deliver hyper-relevant job recommendations to every user.',
    },
    {
      icon: Heart,
      title: 'User-Centric Design',
      description: 'From intuitive job search to one-click applications, every feature is designed for simplicity. We support English, Hindi, and Bengali to serve a diverse user base.',
    },
    {
      icon: Shield,
      title: 'Trust & Transparency',
      description: 'Every aggregated job listing is attributed to its source. We never charge job seekers for registration, applications, or placement. Our platform is 100% free for candidates.',
    },
  ];

  const services = [
    {
      icon: Briefcase,
      title: 'Smart Job Discovery',
      description: 'Browse thousands of verified job listings across IT, insurance, banking, healthcare, manufacturing, and more. Filter by location, experience, salary, and job type to find your perfect match.',
    },
    {
      icon: Bot,
      title: 'AI Resume Builder & Checker',
      description: 'Create ATS-optimized resumes using our AI-powered resume builder. Our resume checker scores your resume against industry standards and provides actionable improvement suggestions.',
    },
    {
      icon: Building2,
      title: 'Company Research',
      description: 'Research potential employers before you apply. Our AI-powered company research tool provides insights into company culture, recent news, and interview preparation tips.',
    },
    {
      icon: BookOpen,
      title: 'Career Blog & Resources',
      description: 'Access 50+ expert-written articles covering career advice, interview preparation, resume tips, salary negotiation, and industry trends to accelerate your professional growth.',
    },
    {
      icon: GraduationCap,
      title: 'Fresher-Friendly',
      description: 'Dedicated job categories for freshers and recent graduates. Our platform connects entry-level talent with employers actively hiring for trainee and junior positions.',
    },
    {
      icon: Lightbulb,
      title: 'Employer Solutions',
      description: 'Employers can post jobs, manage applications, and access AI-powered candidate matching. Our tiered plans offer priority placement, WhatsApp notifications, and featured listings.',
    },
  ];

  const milestones = [
    { year: '2025', event: 'TrueJobs founded with a vision to democratize job search in India using AI technology.' },
    { year: '2025', event: 'Launched AI-powered job matching engine and multi-language support (English, Hindi, Bengali).' },
    { year: '2025', event: 'Integrated automated job aggregation from leading company career pages and ATS platforms.' },
    { year: '2026', event: 'Expanded to 1,000+ active job listings with dedicated insurance, IT, and fresher job categories.' },
    { year: '2026', event: 'Launched AI Resume Builder, Resume Checker, and Company Research tools for job seekers.' },
  ];

  return (
    <Layout>
      <AdPlaceholder variant="banner" />
      <SEO 
        title="About Us - TrueJobs | India's AI-Powered Job Portal" 
        description="TrueJobs is India's AI-powered job portal connecting talented professionals with leading companies. Learn about our mission, services, team, and how we're transforming hiring in India."
        url="/aboutus"
      />
      
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary/10 via-background to-secondary/10 py-16 md:py-20">
        <div className="container mx-auto px-4 text-center max-w-4xl">
          <Badge variant="secondary" className="mb-4">About TrueJobs</Badge>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6 leading-tight">
            Transforming How India Finds Work
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
            TrueJobs is an AI-powered job portal built in India, for India. We combine intelligent 
            technology with human-centric design to connect the right talent with the right 
            opportunities, from metropolitan hubs to emerging Tier-2 and Tier-3 cities.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Button asChild size="lg">
              <Link to="/jobs">Browse Jobs <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/contactus">Contact Us</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {stats.map((stat) => (
              <Card key={stat.label} className="text-center">
                <CardContent className="pt-6">
                  <stat.icon className="h-8 w-8 mx-auto mb-3 text-primary" />
                  <div className="text-2xl md:text-3xl font-bold text-primary mb-1">{stat.value}</div>
                  <div className="text-xs sm:text-sm text-muted-foreground">{stat.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="text-center text-xs text-muted-foreground mt-4">
            * Numbers are approximate and include listings from aggregated sources. Updated periodically.
          </p>
        </div>
      </section>

      {/* Our Story */}
      <section className="py-16">
        <div className="container mx-auto px-4 max-w-4xl content-area">
          <h2 className="text-3xl font-bold text-center mb-8">Our Story</h2>
          <div className="prose prose-lg dark:prose-invert max-w-none space-y-4">
            <p>
              TrueJobs was founded in 2025 with a clear mission: to make job searching in India 
              smarter, faster, and genuinely helpful. We observed that millions of job seekers, 
              particularly freshers, graduates from non-metro cities, and career changers, were 
              underserved by existing job platforms that focused primarily on top-tier candidates 
              in major metros.
            </p>
            <p>
              Our founding team set out to build a platform that uses artificial intelligence not 
              as a buzzword, but as a practical tool to understand what each job seeker truly needs 
              and what each employer genuinely requires. By analyzing skills, experience levels, 
              location preferences, and career trajectories, our AI engine creates meaningful 
              connections between talent and opportunity.
            </p>
            <p>
              Today, TrueJobs aggregates job listings from multiple verified sources, including 
              direct employer postings and publicly available career pages of reputed companies. 
              Every aggregated listing is transparently attributed to its original source, ensuring 
              users can always verify and apply directly. We maintain strict editorial standards 
              to ensure that our platform only features legitimate, actionable job opportunities.
            </p>
            <p>
              What sets us apart is our commitment to being completely free for job seekers. We 
              never charge candidates for registration, job applications, or placement. Our revenue 
              comes from employer services, premium job postings, and advertising, allowing us to 
              keep the platform accessible to everyone regardless of their financial situation.
            </p>
          </div>
        </div>
      </section>

      {/* Our Services */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Our Services</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              TrueJobs offers a comprehensive suite of tools and services designed to empower 
              both job seekers and employers throughout the hiring journey.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {services.map((service) => (
              <Card key={service.title}>
                <CardContent className="pt-6">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <service.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{service.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{service.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Our Values */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Our Core Values</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {values.map((value) => (
              <Card key={value.title} className="text-center">
                <CardContent className="pt-6">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <value.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">{value.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{value.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Milestones */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4 max-w-3xl">
          <h2 className="text-3xl font-bold text-center mb-12">Our Journey</h2>
          <div className="space-y-6">
            {milestones.map((milestone, index) => (
              <div key={index} className="flex gap-4">
                <div className="shrink-0 w-16 text-right">
                  <span className="text-sm font-bold text-primary">{milestone.year}</span>
                </div>
                <div className="relative">
                  <div className="absolute top-2 -left-[5px] h-2.5 w-2.5 rounded-full bg-primary" />
                  <div className="border-l-2 border-primary/20 pl-6 pb-6">
                    <p className="text-sm text-muted-foreground">{milestone.event}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose TrueJobs */}
      <section className="py-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <h2 className="text-3xl font-bold text-center mb-8">Why Choose TrueJobs?</h2>
          <div className="space-y-6">
            {[
              { icon: Zap, title: 'AI-Powered Job Matching', desc: 'Our intelligent algorithms analyze your profile, skills, and preferences to recommend jobs that align with your career goals, not just keyword matches.' },
              { icon: Globe, title: 'Pan-India Coverage', desc: 'From Mumbai and Bangalore to Lucknow, Patna, and beyond. We actively source opportunities from metros, Tier-2, and Tier-3 cities across all major states.' },
              { icon: TrendingUp, title: 'Career Growth Resources', desc: 'Beyond job listings, access expert-written career blogs, AI-powered resume tools, and company research to make informed career decisions.' },
              { icon: Shield, title: '100% Free for Job Seekers', desc: 'No registration fees, no application charges, no hidden costs. TrueJobs is completely free for candidates. We believe access to opportunity should never be behind a paywall.' },
              { icon: CheckCircle, title: 'Verified & Transparent Listings', desc: 'Every job listing on TrueJobs is verified for authenticity. We ensure all postings come from legitimate employers and official government notifications.' },
            ].map((item) => (
              <div key={item.title} className="flex gap-4">
                <div className="shrink-0">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <item.icon className="h-5 w-5 text-primary" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold mb-1">{item.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MSME Registration */}
      <section className="py-12 bg-muted/30 border-t">
        <div className="container mx-auto px-4 max-w-4xl">
          <MSMECredibility />
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-primary/5 border-t">
        <div className="container mx-auto px-4 text-center max-w-2xl">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Join the TrueJobs Community</h2>
          <p className="text-muted-foreground mb-8">
            Whether you're a fresh graduate looking for your first job or an experienced professional 
            seeking new challenges, TrueJobs is here to help you find your next opportunity.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Button asChild size="lg">
              <Link to="/enrol-now">Register Now — It's Free</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/blog">Read Career Blog</Link>
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  );
}
