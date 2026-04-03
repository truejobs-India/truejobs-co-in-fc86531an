import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { BookOpen, Clock, ArrowRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  cover_image_url: string | null;
  published_at: string | null;
  reading_time: number | null;
  category: string | null;
}

interface RelatedBlogsProps {
  currentPostId: string;
  category: string | null;
  tags: string[] | null;
  limit?: number;
}

export function RelatedBlogs({ currentPostId, category, tags, limit = 3 }: RelatedBlogsProps) {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchRelatedPosts();
  }, [currentPostId, category]);

  const fetchRelatedPosts = async () => {
    setIsLoading(true);
    
    // First try to get posts from the same category
    let query = supabase
      .from('blog_posts')
      .select('id, title, slug, excerpt, cover_image_url, published_at, reading_time, category')
      .eq('is_published', true)
      .neq('id', currentPostId)
      .order('published_at', { ascending: false })
      .limit(limit);

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;

    if (!error && data && data.length > 0) {
      setPosts(data);
    } else {
      // Fallback: get any recent posts
      const { data: fallbackData } = await supabase
        .from('blog_posts')
        .select('id, title, slug, excerpt, cover_image_url, published_at, reading_time, category')
        .eq('is_published', true)
        .neq('id', currentPostId)
        .order('published_at', { ascending: false })
        .limit(limit);
      
      if (fallbackData) {
        setPosts(fallbackData);
      }
    }
    
    setIsLoading(false);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Related Articles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-16 w-16 rounded shrink-0" />
              <div className="flex-1">
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (posts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <CardTitle className="text-xl">Related Articles</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No related articles found.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          <CardTitle className="text-xl">Related Articles</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {posts.map((post) => (
          <Link 
            key={post.id} 
            to={`/blog/${post.slug}`}
            className="flex gap-3 group"
          >
            {post.cover_image_url ? (
              <img
                src={post.cover_image_url}
                alt={`Thumbnail for ${post.title}`}
                className="h-16 w-16 object-cover rounded shrink-0"
                loading="lazy"
              />
            ) : (
              <div className="h-16 w-16 bg-muted rounded shrink-0 flex items-center justify-center">
                <BookOpen className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-sm line-clamp-2 group-hover:text-primary transition-colors">
                {post.title}
              </h4>
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                {post.category && (
                  <Badge variant="secondary" className="text-xs px-1.5 py-0">
                    {post.category}
                  </Badge>
                )}
                {post.reading_time && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {post.reading_time} min
                  </span>
                )}
              </div>
            </div>
          </Link>
        ))}
        
        <Link 
          to="/blog"
          className="flex items-center gap-1 text-sm text-primary hover:underline pt-2"
        >
          View All Articles
          <ArrowRight className="h-4 w-4" />
        </Link>
      </CardContent>
    </Card>
  );
}
