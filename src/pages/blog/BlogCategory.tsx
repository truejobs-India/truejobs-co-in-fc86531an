import { useEffect, useState } from 'react';
import { AdPlaceholder } from '@/components/ads/AdPlaceholder';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { SEO } from '@/components/SEO';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { Calendar, Clock, ArrowRight, ArrowLeft, Tag, BookOpen } from 'lucide-react';
import { BLOG_CATEGORIES } from '@/lib/blogCategories';
import { slugToCategory } from '@/lib/blogUtils';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  cover_image_url: string | null;
  published_at: string | null;
  created_at: string;
  reading_time: number | null;
  category: string | null;
  tags: string[] | null;
}

export default function BlogCategory() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const categoryInfo = BLOG_CATEGORIES.find(c => c.slug === slug);
  const categoryName = categoryInfo?.name || slugToCategory(slug || '');

  useEffect(() => {
    if (slug) {
      fetchPosts();
    }
  }, [slug]);

  const fetchPosts = async () => {
    setIsLoading(true);
    const catName = slugToCategory(slug || '');
    
    const { data, error } = await supabase
      .from('blog_posts')
      .select('id, title, slug, excerpt, cover_image_url, published_at, created_at, reading_time, category, tags')
      .eq('is_published', true)
      .eq('category', catName)
      .order('published_at', { ascending: false });

    if (!error && data) {
      setPosts(data);
    }
    setIsLoading(false);
  };

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${categoryName} - TrueJobs Blog`,
    description: `Read the latest ${categoryName} articles from TrueJobs`,
    url: `https://truejobs.co.in/blog/category/${slug}`,
    isPartOf: {
      '@type': 'Blog',
      name: 'TrueJobs Blog',
      url: 'https://truejobs.co.in/blog',
    },
  };

  return (
    <Layout>
      <SEO 
        title={`${categoryName} - Career Tips & Insights`}
        description={`Read the latest ${categoryName} articles, tips, and insights from TrueJobs to advance your career in India.`}
        url={`/blog/category/${slug}`}
        structuredData={structuredData}
      />
      
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="border-b bg-background">
        <div className="container mx-auto px-4 py-3">
          <ol className="flex items-center gap-2 text-sm text-muted-foreground" itemScope itemType="https://schema.org/BreadcrumbList">
            <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
              <Link to="/" itemProp="item" className="hover:text-primary"><span itemProp="name">Home</span></Link>
              <meta itemProp="position" content="1" />
            </li>
            <li className="text-muted-foreground">/</li>
            <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
              <Link to="/blog" itemProp="item" className="hover:text-primary"><span itemProp="name">Blog</span></Link>
              <meta itemProp="position" content="2" />
            </li>
            <li className="text-muted-foreground">/</li>
            <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
              <span itemProp="name" className="text-foreground font-medium">{categoryName}</span>
              <meta itemProp="position" content="3" />
            </li>
          </ol>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary/10 via-background to-secondary/10 py-12">
        <div className="container mx-auto px-4">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/blog')}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Blog
          </Button>
          
          <div className="text-center">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-primary/10 mb-4">
              <Tag className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-4xl font-bold mb-4">{categoryName}</h1>
            <Badge variant="secondary" className="mt-4">
              {posts.length} {posts.length === 1 ? 'Article' : 'Articles'}
            </Badge>
          </div>
        </div>
      </section>

      {/* Category Navigation — canonical 16 categories */}
      <section className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-wrap gap-2 justify-center">
            {BLOG_CATEGORIES.map((cat) => (
              <Link key={cat.slug} to={`/blog/category/${cat.slug}`}>
                <Badge 
                  variant={cat.slug === slug ? 'default' : 'outline'}
                  className="cursor-pointer hover:bg-primary/10 transition-colors"
                >
                  {cat.name}
                </Badge>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 lg:px-8 py-12">
        <AdPlaceholder variant="banner" />
        {isLoading ? (
          <div className="grid md:grid-cols-2 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i}>
                <Skeleton className="aspect-[16/9] w-full rounded-t-lg" />
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-full mt-2" />
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <Card className="max-w-lg mx-auto">
            <CardContent className="text-center py-12">
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Articles Yet</h3>
              <p className="text-muted-foreground mb-4">
                We're working on great {categoryName.toLowerCase()} content. Check back soon!
              </p>
              <Button onClick={() => navigate('/blog')}>
                Browse All Articles
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {posts.map((post) => (
              <Link key={post.id} to={`/blog/${post.slug}`}>
                <Card className="h-full hover:shadow-lg transition-shadow overflow-hidden group">
                  {post.cover_image_url ? (
                    <div className="aspect-[16/9] overflow-hidden">
                      <img
                        src={post.cover_image_url}
                        alt={`Featured image for ${post.title}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    </div>
                  ) : (
                    <div className="aspect-[16/9] bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                      <BookOpen className="h-12 w-12 text-primary/50" />
                    </div>
                  )}
                  <CardHeader>
                    <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span>
                          {post.published_at 
                            ? formatDistanceToNow(new Date(post.published_at), { addSuffix: true })
                            : formatDistanceToNow(new Date(post.created_at), { addSuffix: true })
                          }
                        </span>
                      </div>
                      {post.reading_time && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          <span>{post.reading_time} min</span>
                        </div>
                      )}
                    </div>
                    <CardTitle className="line-clamp-2 group-hover:text-primary transition-colors">
                      {post.title}
                    </CardTitle>
                    {post.excerpt && (
                      <CardDescription className="line-clamp-2">
                        {post.excerpt}
                      </CardDescription>
                    )}
                    {post.tags && post.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {post.tags.slice(0, 3).map((tag, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-primary font-medium mt-3">
                      Read More <ArrowRight className="h-4 w-4" />
                    </div>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* CTA Section */}
      <section className="bg-muted/50 py-12">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold mb-4">Ready to Find Your Dream Job?</h2>
          <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
            Browse thousands of job opportunities across India and apply with confidence.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Button asChild size="lg">
              <Link to="/jobs">Search Jobs</Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link to="/dashboard">AI Resume Builder</Link>
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  );
}
