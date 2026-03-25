import { Layout } from '@/components/layout/Layout';
import { SEO } from '@/components/SEO';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Briefcase } from 'lucide-react';

export default function ThankYou() {
  return (
    <Layout>
      <SEO 
        title="Thank You - Jobs Campaign | TrueJobs" 
        description="Thank you for enrolling in our jobs campaign."
        url="/thankyou"
      />
      <div className="min-h-[80vh] flex items-center justify-center bg-gradient-to-br from-background to-secondary/30 px-4">
        <div className="text-center max-w-lg animate-fade-in">
          <div className="mb-6 flex justify-center">
            <div className="h-28 w-28 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shadow-lg animate-pulse">
              <CheckCircle2 className="h-16 w-16 text-white" />
            </div>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Thank You for Enrolling!
          </h1>
          <p className="text-lg text-muted-foreground mb-6">
            Your application has been received successfully. Our team will review your profile and 
            <span className="font-semibold text-primary"> connect with you within 24 to 48 hours</span>.
          </p>
          <div className="glass-strong rounded-2xl p-6 mb-6 shadow-medium">
            <p className="text-sm text-muted-foreground">
              📧 Keep an eye on your email and phone for updates. Make sure to check your spam folder too!
            </p>
          </div>
          <Button 
            onClick={() => window.location.href = '/jobs'}
            className="bg-gradient-primary hover:opacity-90 shadow-primary text-primary-foreground px-8"
            size="lg"
          >
            <Briefcase className="mr-2 h-5 w-5" />
            Browse Current Openings
          </Button>
        </div>
      </div>
    </Layout>
  );
}
