import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Layout } from "@/components/layout/Layout";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Home, Search, ArrowLeft } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const { t } = useLanguage();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <Layout>
      <SEO 
        title="Page Not Found" 
        description="The page you're looking for doesn't exist. Browse jobs, read career tips, or return to the homepage."
        noindex={true}
      />
      <main className="flex items-center justify-center py-20 px-4">
        <div className="text-center max-w-md">
          <h1 className="text-7xl font-bold text-primary mb-4">404</h1>
          <h2 className="text-2xl font-semibold text-foreground mb-3">{t('notFound.title')}</h2>
          <p className="text-muted-foreground mb-8">{t('notFound.message')}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild>
              <Link to="/">
                <Home className="h-4 w-4 mr-2" />
                {t('notFound.returnHome')}
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/jobs">
                <Search className="h-4 w-4 mr-2" />
                Browse Jobs
              </Link>
            </Button>
          </div>
        </div>
      </main>
    </Layout>
  );
};

export default NotFound;
