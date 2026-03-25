import { useEffect, useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { WifiOff, RefreshCw, Briefcase, MapPin, Building2 } from 'lucide-react';
import { Link } from 'react-router-dom';

interface CachedJob {
  id: string;
  slug: string;
  title: string;
  company_name: string | null;
  location: string | null;
  job_type: string;
}

export default function Offline() {
  const [cachedJobs, setCachedJobs] = useState<CachedJob[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    // Load cached jobs from localStorage
    const cached = localStorage.getItem('cachedJobs');
    if (cached) {
      try {
        setCachedJobs(JSON.parse(cached));
      } catch (e) {
        console.error('Failed to parse cached jobs');
      }
    }

    // Listen for online/offline events
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleRetry = () => {
    if (navigator.onLine) {
      window.location.href = '/';
    } else {
      window.location.reload();
    }
  };

  if (isOnline) {
    // Redirect to home if back online
    window.location.href = '/';
    return null;
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-16">
        {/* Offline Message */}
        <div className="max-w-2xl mx-auto text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-orange-100 mb-6">
            <WifiOff className="h-10 w-10 text-orange-600" />
          </div>
          
          <h1 className="text-3xl font-bold mb-4">You're Offline</h1>
          <p className="text-lg text-muted-foreground mb-6">
            It looks like you've lost your internet connection. Don't worry - you can still browse some cached content below.
          </p>
          
          <Button onClick={handleRetry} size="lg" className="gap-2">
            <RefreshCw className="h-5 w-5" />
            Try Again
          </Button>
        </div>

        {/* Cached Jobs */}
        {cachedJobs.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-6 text-center">
              Recently Viewed Jobs
            </h2>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
              {cachedJobs.map((job) => (
                <Card key={job.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <h3 className="font-semibold mb-2 line-clamp-1">{job.title}</h3>
                    
                    {job.company_name && (
                      <p className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
                        <Building2 className="h-4 w-4" />
                        {job.company_name}
                      </p>
                    )}
                    
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      {job.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {job.location}
                        </span>
                      )}
                      <Badge variant="outline" className="text-xs">
                        {job.job_type?.replace('_', ' ')}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {cachedJobs.length === 0 && (
          <Card className="max-w-md mx-auto">
            <CardContent className="p-8 text-center">
              <Briefcase className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">No Cached Content</h3>
              <p className="text-sm text-muted-foreground">
                Browse some jobs while online to cache them for offline viewing.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Tips */}
        <div className="max-w-2xl mx-auto mt-12 p-6 bg-muted/50 rounded-xl">
          <h3 className="font-semibold mb-3">Tips for offline browsing:</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• Install our app to your home screen for better offline support</li>
            <li>• Recently viewed jobs are automatically cached</li>
            <li>• Your saved jobs and applications will sync when you're back online</li>
          </ul>
        </div>
      </div>
    </Layout>
  );
}
