UPDATE blog_posts 
SET title = split_part(title, '",', 1)
WHERE title LIKE '%"slug":%' AND length(title) > 500;