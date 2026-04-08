import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { SEO } from '@/components/SEO';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { Calendar, Clock, ArrowRight, BookOpen, Search } from 'lucide-react';

import searchJobsBtn from '@/assets/btn-search-jobs.png';
import aiResumeBtn from '@/assets/btn-ai-resume.png';
import { AdPlaceholder } from '@/components/ads/AdPlaceholder';
import { JobAlertCTA } from '@/components/shared/JobAlertCTA';

import { BLOG_CATEGORIES } from '@/lib/blogCategories';

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

const PAGE_SIZE = 12;

export default function Blog() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [featuredPost, setFeaturedPost] = useState<BlogPost | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Reset and fetch when filters change
  useEffect(() => {
    setPosts([]);
    setFeaturedPost(null);
    setPage(0);
    setHasMore(true);
    fetchPosts(0, true);
  }, [selectedCategory, searchQuery]);

  const fetchPosts = async (pageNum: number, isReset: boolean) => {
    if (isReset) setIsLoading(true);
    else setIsLoadingMore(true);

    const from = pageNum * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from('blog_posts')
      .select('id, title, slug, excerpt, cover_image_url, published_at, created_at, reading_time, category, tags')
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .range(from, to);

    if (selectedCategory) {
      query = query.eq('category', selectedCategory);
    }

    if (searchQuery.trim()) {
      query = query.or(`title.ilike.%${searchQuery}%,excerpt.ilike.%${searchQuery}%`);
    }

    const { data, error } = await query;

    if (!error && data) {
      if (data.length < PAGE_SIZE) setHasMore(false);

      if (isReset) {
        if (!selectedCategory && !searchQuery.trim() && data.length > 0) {
          setFeaturedPost(data[0]);
          setPosts(data.slice(1));
        } else {
          setFeaturedPost(null);
          setPosts(data);
        }
      } else {
        // Deduplicate by id on append
        setPosts(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const newPosts = data.filter(p => !existingIds.has(p.id));
          return [...prev, ...newPosts];
        });
      }
    }
    setIsLoading(false);
    setIsLoadingMore(false);
  };

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchPosts(nextPage, false);
  };

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: 'TrueJobs Blog - Career Tips & Industry Insights',
    description: 'Read the latest career advice, job search tips, and industry insights from TrueJobs. Stay informed and advance your career in India.',
    url: 'https://truejobs.co.in/blog',
    publisher: {
      '@type': 'Organization',
      name: 'TrueJobs',
      logo: {
        '@type': 'ImageObject',
        url: 'https://truejobs.co.in/favicon.png',
      },
    },
  };

  return (
    <Layout>
      <SEO 
        title="Blog - Career Tips & Industry Insights" 
        description="Read the latest career advice, job search tips, resume writing guides, and interview preparation strategies from TrueJobs. Expert insights for job seekers in India."
        url="/blog"
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
              <span itemProp="name" className="text-foreground font-medium">Blog</span>
              <meta itemProp="position" content="2" />
            </li>
          </ol>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary/10 via-background to-secondary/10 py-12">
        <div className="container mx-auto px-4 text-center">
          <BookOpen className="h-12 w-12 mx-auto mb-4 text-primary" />
          <h1 className="text-4xl font-bold mb-4">TrueJobs Blog</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-6">
            Career tips, job search strategies, resume writing guides, and interview preparation insights to help you succeed in India's job market.
          </p>
          
          {/* Search Bar */}
          <div className="max-w-md mx-auto relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search articles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12 text-base bg-background/80 backdrop-blur border-primary/20 focus:border-primary"
            />
          </div>
        </div>
      </section>

      {/* Category Navigation */}
      <section className="border-b sticky top-16 bg-background/95 backdrop-blur z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-wrap gap-2 justify-center">
            <Badge 
              variant={selectedCategory === null ? 'default' : 'outline'}
              className="cursor-pointer hover:bg-primary/10 transition-colors"
              onClick={() => setSelectedCategory(null)}
            >
              All Articles
            </Badge>
            {BLOG_CATEGORIES.map((cat) => (
              <Badge 
                key={cat.slug}
                variant={selectedCategory === cat.name ? 'default' : 'outline'}
                className="cursor-pointer hover:bg-primary/10 transition-colors"
                onClick={() => setSelectedCategory(cat.name)}
              >
                {cat.name}
              </Badge>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 my-6">
        <AdPlaceholder variant="banner" />
      </div>

      <div className="container mx-auto px-4 py-12">
       <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8">
       <div className="min-w-0">
        {isLoading ? (
          <div className="space-y-8">
            {/* Featured skeleton */}
            <Card className="overflow-hidden">
              <div className="grid md:grid-cols-2">
                <Skeleton className="h-64 md:h-80" />
                <div className="p-6">
                  <Skeleton className="h-8 w-3/4 mb-4" />
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              </div>
            </Card>
            
            <div className="grid md:grid-cols-2 gap-6">
              {[...Array(6)].map((_, i) => (
                <Card key={i}>
                  <Skeleton className="h-48 w-full rounded-t-lg" />
                  <CardHeader>
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-full mt-2" />
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        ) : posts.length === 0 && !featuredPost ? (
          <Card className="max-w-lg mx-auto">
            <CardContent className="text-center py-12">
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Articles Yet</h3>
              <p className="text-muted-foreground">
                {selectedCategory 
                  ? `No articles in "${selectedCategory}" yet. Check back soon!`
                  : "We're working on great content. Check back soon!"}
              </p>
              {selectedCategory && (
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => setSelectedCategory(null)}
                >
                  View All Articles
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-12">
            {/* Featured Post */}
            {featuredPost && (
              <Link to={`/blog/${featuredPost.slug}`}>
                <Card className="overflow-hidden hover:shadow-xl transition-shadow group">
                  <div className="grid md:grid-cols-2">
                    <div className="h-64 md:h-80 overflow-hidden">
                      {featuredPost.cover_image_url ? (
                        <img
                          src={featuredPost.cover_image_url}
                          alt={`Featured image for ${featuredPost.title}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="h-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                          <BookOpen className="h-16 w-16 text-primary/50" />
                        </div>
                      )}
                    </div>
                    <div className="p-6 md:p-8 flex flex-col justify-center">
                      <Badge className="w-fit mb-4" variant="secondary">Featured</Badge>
                      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mb-3">
                        {featuredPost.category && (
                          <Badge variant="outline">{featuredPost.category}</Badge>
                        )}
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {featuredPost.published_at 
                            ? formatDistanceToNow(new Date(featuredPost.published_at), { addSuffix: true })
                            : formatDistanceToNow(new Date(featuredPost.created_at), { addSuffix: true })
                          }
                        </span>
                        {featuredPost.reading_time && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {featuredPost.reading_time} min read
                          </span>
                        )}
                      </div>
                      <h2 className="text-2xl md:text-3xl font-bold mb-3 group-hover:text-primary transition-colors">
                        {featuredPost.title}
                      </h2>
                      {featuredPost.excerpt && (
                        <p className="text-muted-foreground line-clamp-3 mb-4">
                          {featuredPost.excerpt}
                        </p>
                      )}
                      <div className="flex items-center gap-1 text-primary font-medium">
                        Read Full Article <ArrowRight className="h-4 w-4" />
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            )}

            {/* Post Grid */}
            {posts.length > 0 && (
              <div className="grid md:grid-cols-2 gap-6">
                {posts.map((post, index) => (
                  <React.Fragment key={post.id}>
                    {/* Insert in-content ad after 6th post (index 5) */}
                    {index === 6 && (
                      <div className="md:col-span-2">
                        <AdPlaceholder variant="in-content" />
                      </div>
                    )}
                    <Link to={`/blog/${post.slug}`}>
                      <Card className="h-full hover:shadow-lg transition-shadow overflow-hidden group">
                        {post.cover_image_url ? (
                        <div className="aspect-[16/9] overflow-hidden">
                            <img
                              src={post.cover_image_url}
                              alt={`Cover image for ${post.title}`}
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
                              <span className="flex items-center gap-1">
                                <Clock className="h-4 w-4" />
                                {post.reading_time} min
                              </span>
                            )}
                          </div>
                          {post.category && (
                            <Badge variant="secondary" className="w-fit mb-2">
                              {post.category}
                            </Badge>
                          )}
                          <CardTitle className="line-clamp-2 group-hover:text-primary transition-colors">
                            {post.title}
                          </CardTitle>
                          {post.excerpt && (
                            <CardDescription className="line-clamp-2">
                              {post.excerpt}
                            </CardDescription>
                          )}
                          {post.tags && post.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-3">
                              {post.tags.slice(0, 3).map((tag, i) => (
                                <Badge key={i} variant="outline" className="text-xs">
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
                  </React.Fragment>
                ))}
                {/* If fewer than 7 posts, ad goes at the end of the grid */}
                {posts.length > 0 && posts.length <= 6 && (
                  <div className="md:col-span-2">
                    <AdPlaceholder variant="in-content" />
                  </div>
                )}
              </div>
            )}

            {/* Load More Button */}
            {hasMore && !isLoading && posts.length > 0 && (
              <div className="text-center mt-8">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? 'Loading…' : 'Load More Articles'}
                </Button>
              </div>
            )}
          </div>
        )}
       </div>
       <aside className="hidden lg:block">
         <div className="sticky top-24">
           <AdPlaceholder variant="sidebar" />
         </div>
       </aside>
       </div>
      </div>



      {/* Category Browse Section */}
      <section className="bg-muted/30 py-12">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-8">Browse by Category</h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {BLOG_CATEGORIES.map((cat) => (
              <Link 
                key={cat.slug} 
                to={`/blog/category/${cat.slug}`}
                className="group flex items-center gap-3 p-4 bg-background rounded-lg border hover:border-primary/50 hover:shadow-md transition-all"
              >
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0 group-hover:scale-110 group-hover:shadow-lg transition-all">
                  <img src={cat.image} alt={cat.name} className="h-8 w-8 object-contain" />
                </div>
                <span className="font-medium">{cat.name}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter / CTA Section */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <Card className="bg-gradient-to-r from-primary/10 to-secondary/10 border-2 border-primary/20">
            <CardContent className="p-8 text-center">
              <h2 className="text-2xl font-bold mb-4">Ready to Find Your Dream Job?</h2>
              <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
                Apply our career tips and start your job search on TrueJobs today. 
                Access thousands of verified opportunities across India.
              </p>
              <div className="flex flex-wrap gap-6 justify-center items-center">
                <Link to="/jobs" className="hover:scale-105 transition-transform">
                  <img src={searchJobsBtn} alt="Search Jobs" className="h-12 w-auto" />
                </Link>
                <Link to="/dashboard" className="hover:scale-105 transition-transform">
                  <img src={aiResumeBtn} alt="AI Resume Builder" className="h-12 w-auto" />
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Distribution widgets */}
      <section className="py-10">
        <div className="container mx-auto px-4 max-w-2xl">
          <JobAlertCTA variant="strong" />
        </div>
      </section>
    </Layout>
  );
}
