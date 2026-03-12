import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CompanyResearch as CompanyResearchType } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Building2, Users, Newspaper, Package, Swords, Gift, 
  Lightbulb, RefreshCw, ExternalLink, Clock
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

interface CompanyResearchProps {
  companyName: string;
  companyWebsite?: string | null;
  jobTitle?: string;
  existingResearch?: CompanyResearchType | Record<string, unknown> | null;
  onResearchFetched?: (research: CompanyResearchType) => void;
}

export function CompanyResearch({
  companyName,
  companyWebsite,
  jobTitle,
  existingResearch,
  onResearchFetched,
}: CompanyResearchProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [research, setResearch] = useState<CompanyResearchType | null>(
    existingResearch && 'overview' in existingResearch ? existingResearch as CompanyResearchType : null
  );

  const fetchResearch = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('company-research', {
        body: { companyName, companyWebsite, jobTitle },
      });

      if (error) throw error;

      if (data?.success && data.data) {
        setResearch(data.data);
        onResearchFetched?.(data.data);
        toast({ title: 'Research fetched successfully!' });
      } else {
        throw new Error(data?.error || 'Failed to fetch research');
      }
    } catch (error: any) {
      console.error('Error fetching research:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch company research',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </CardContent>
      </Card>
    );
  }

  if (!research) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Research {companyName}
          </CardTitle>
          <CardDescription>
            Get AI-powered insights about the company to prepare for your application
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={fetchResearch} className="w-full">
            <Lightbulb className="h-4 w-4 mr-2" />
            Generate Company Research
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              {companyName} Research
            </CardTitle>
            {research.fetchedAt && (
              <CardDescription className="flex items-center gap-1 mt-1">
                <Clock className="h-3 w-3" />
                Updated {formatDistanceToNow(new Date(research.fetchedAt), { addSuffix: true })}
              </CardDescription>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={fetchResearch}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid grid-cols-4 lg:grid-cols-5 w-full">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="culture">Culture</TabsTrigger>
            <TabsTrigger value="news">News</TabsTrigger>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="interview" className="hidden lg:block">Interview</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-4">
            <div>
              <h4 className="font-semibold mb-2">Company Overview</h4>
              <p className="text-sm text-muted-foreground whitespace-pre-line">
                {research.overview}
              </p>
            </div>

            {research.keyPeople?.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Key People
                </h4>
                <div className="flex flex-wrap gap-2">
                  {research.keyPeople.map((person, i) => (
                    <Badge key={i} variant="outline">{person}</Badge>
                  ))}
                </div>
              </div>
            )}

            {research.competitors?.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Swords className="h-4 w-4" />
                  Competitors
                </h4>
                <div className="flex flex-wrap gap-2">
                  {research.competitors.map((comp, i) => (
                    <Badge key={i} variant="secondary">{comp}</Badge>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="culture" className="space-y-4 mt-4">
            <div>
              <h4 className="font-semibold mb-2">Company Culture</h4>
              <p className="text-sm text-muted-foreground whitespace-pre-line">
                {research.culture}
              </p>
            </div>

            {research.benefits?.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Gift className="h-4 w-4" />
                  Benefits & Perks
                </h4>
                <ul className="space-y-1">
                  {research.benefits.map((benefit, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-primary">•</span>
                      {benefit}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </TabsContent>

          <TabsContent value="news" className="mt-4">
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <Newspaper className="h-4 w-4" />
              Recent News & Updates
            </h4>
            {research.recentNews?.length > 0 ? (
              <ScrollArea className="h-48">
                <ul className="space-y-2">
                  {research.recentNews.map((news, i) => (
                    <li key={i} className="text-sm p-2 bg-muted rounded-lg">
                      {news}
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            ) : (
              <p className="text-sm text-muted-foreground">No recent news available</p>
            )}
          </TabsContent>

          <TabsContent value="products" className="mt-4">
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <Package className="h-4 w-4" />
              Products & Services
            </h4>
            {research.products?.length > 0 ? (
              <ul className="space-y-2">
                {research.products.map((product, i) => (
                  <li key={i} className="text-sm p-2 bg-muted rounded-lg flex items-start gap-2">
                    <span className="text-primary font-bold">{i + 1}.</span>
                    {product}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No product information available</p>
            )}
          </TabsContent>

          <TabsContent value="interview" className="mt-4">
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <Lightbulb className="h-4 w-4" />
              Interview Tips
            </h4>
            {research.interviewTips?.length > 0 ? (
              <ScrollArea className="h-64">
                <ul className="space-y-3">
                  {research.interviewTips.map((tip, i) => (
                    <li key={i} className="text-sm p-3 bg-primary/5 border-l-2 border-primary rounded-r-lg">
                      <span className="font-medium text-primary">Tip {i + 1}:</span>{' '}
                      {tip}
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            ) : (
              <p className="text-sm text-muted-foreground">No interview tips available</p>
            )}
          </TabsContent>
        </Tabs>

        {companyWebsite && (
          <div className="mt-4 pt-4 border-t">
            <Button variant="outline" size="sm" asChild>
              <a href={companyWebsite} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Visit Company Website
              </a>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
