import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Building2 } from 'lucide-react';
import searchJobsBtn from '@/assets/btn-search-jobs.png';
import aiResumeBtn from '@/assets/btn-ai-resume.png';

interface BlogCTAProps {
  variant?: 'jobs' | 'resume' | 'employer' | 'all';
}

export function BlogCTA({ variant = 'all' }: BlogCTAProps) {
  const ctas = {
    jobs: {
      title: 'Ready to Apply?',
      description: 'Browse thousands of verified job opportunities across India.',
      buttonImage: searchJobsBtn,
      buttonAlt: 'Search Jobs',
      buttonLink: '/jobs',
      gradient: 'from-blue-500/10 to-primary/10',
    },
    resume: {
      title: 'Perfect Your Resume',
      description: 'Use our AI-powered Resume Builder to create ATS-optimized resumes.',
      buttonImage: aiResumeBtn,
      buttonAlt: 'AI Resume Builder',
      buttonLink: '/dashboard',
      gradient: 'from-green-500/10 to-emerald-500/10',
    },
    employer: {
      icon: Building2,
      title: 'Hiring? Post Your Job',
      description: 'Reach millions of qualified candidates. Start hiring faster today.',
      buttonText: 'Post a Job',
      buttonLink: '/employer/post-job',
      gradient: 'from-purple-500/10 to-pink-500/10',
    },
  };

  if (variant === 'all') {
    return (
      <div className="grid md:grid-cols-3 gap-4 my-8">
        {Object.entries(ctas).map(([key, cta]) => {
          const hasImage = 'buttonImage' in cta;
          return (
            <Card key={key} className={`bg-gradient-to-br ${cta.gradient} border-2 hover:border-primary/30 transition-colors`}>
              <CardContent className="p-6 text-center">
                {!hasImage && 'icon' in cta && (
                  <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-background mb-4">
                    <cta.icon className="h-6 w-6 text-primary" />
                  </div>
                )}
                <h3 className="font-semibold text-lg mb-2">{cta.title}</h3>
                <p className="text-sm text-muted-foreground mb-4">{cta.description}</p>
                {hasImage ? (
                  <Link to={cta.buttonLink} className="inline-block w-full">
                    <img 
                      src={cta.buttonImage} 
                      alt={cta.buttonAlt} 
                      className="h-10 w-auto mx-auto hover:scale-105 transition-transform"
                      width={120}
                      height={40}
                    />
                  </Link>
                ) : (
                  <Link 
                    to={cta.buttonLink}
                    className="inline-flex items-center justify-center h-9 rounded-md px-3 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 w-full"
                  >
                    {'buttonText' in cta && cta.buttonText}
                  </Link>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }

  const cta = ctas[variant];
  const hasImage = 'buttonImage' in cta;

  return (
    <Card className={`bg-gradient-to-r ${cta.gradient} border-2 border-primary/20 my-8`}>
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row items-center gap-4">
          {!hasImage && 'icon' in cta && (
            <div className="flex items-center justify-center h-14 w-14 rounded-full bg-background shrink-0">
              <cta.icon className="h-7 w-7 text-primary" />
            </div>
          )}
          <div className="flex-1 text-center md:text-left">
            <h3 className="font-semibold text-lg">{cta.title}</h3>
            <p className="text-muted-foreground">{cta.description}</p>
          </div>
          {hasImage ? (
            <Link to={cta.buttonLink} className="shrink-0">
              <img 
                src={cta.buttonImage} 
                alt={cta.buttonAlt} 
                className="h-12 w-auto hover:scale-105 transition-transform"
                width={120}
                height={48}
              />
            </Link>
          ) : (
            <Link 
              to={cta.buttonLink}
              className="inline-flex items-center justify-center h-11 rounded-md px-8 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 shrink-0"
            >
              {'buttonText' in cta && cta.buttonText}
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
