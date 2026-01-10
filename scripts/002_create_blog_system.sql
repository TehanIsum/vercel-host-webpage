-- Blog System Schema for Supabase
-- Run this in your Supabase SQL Editor

-- Create blogs table
create table if not exists public.blogs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  excerpt text,
  author_id uuid references public.profiles(id) on delete cascade not null,
  slug text unique not null,
  published boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create blog_likes table
create table if not exists public.blog_likes (
  id uuid primary key default gen_random_uuid(),
  blog_id uuid references public.blogs(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(blog_id, user_id)
);

-- Create blog_comments table
create table if not exists public.blog_comments (
  id uuid primary key default gen_random_uuid(),
  blog_id uuid references public.blogs(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security
alter table public.blogs enable row level security;
alter table public.blog_likes enable row level security;
alter table public.blog_comments enable row level security;

-- Drop existing policies if they exist
drop policy if exists "blogs_select_all" on public.blogs;
drop policy if exists "blogs_insert_authenticated" on public.blogs;
drop policy if exists "blogs_update_own" on public.blogs;
drop policy if exists "blogs_delete_own" on public.blogs;

drop policy if exists "blog_likes_select_all" on public.blog_likes;
drop policy if exists "blog_likes_insert_authenticated" on public.blog_likes;
drop policy if exists "blog_likes_delete_own" on public.blog_likes;

drop policy if exists "blog_comments_select_all" on public.blog_comments;
drop policy if exists "blog_comments_insert_authenticated" on public.blog_comments;
drop policy if exists "blog_comments_update_own" on public.blog_comments;
drop policy if exists "blog_comments_delete_own" on public.blog_comments;

-- Blogs policies
-- Anyone can view published blogs
create policy "blogs_select_all"
  on public.blogs for select
  using (published = true or auth.uid() = author_id);

-- Authenticated users can create blogs
create policy "blogs_insert_authenticated"
  on public.blogs for insert
  with check (auth.uid() = author_id);

-- Users can update their own blogs
create policy "blogs_update_own"
  on public.blogs for update
  using (auth.uid() = author_id);

-- Users can delete their own blogs
create policy "blogs_delete_own"
  on public.blogs for delete
  using (auth.uid() = author_id);

-- Blog likes policies
-- Anyone can view likes
create policy "blog_likes_select_all"
  on public.blog_likes for select
  using (true);

-- Authenticated users can like blogs
create policy "blog_likes_insert_authenticated"
  on public.blog_likes for insert
  with check (auth.uid() = user_id);

-- Users can unlike (delete their own likes)
create policy "blog_likes_delete_own"
  on public.blog_likes for delete
  using (auth.uid() = user_id);

-- Blog comments policies
-- Anyone can view comments
create policy "blog_comments_select_all"
  on public.blog_comments for select
  using (true);

-- Authenticated users can comment
create policy "blog_comments_insert_authenticated"
  on public.blog_comments for insert
  with check (auth.uid() = user_id);

-- Users can update their own comments
create policy "blog_comments_update_own"
  on public.blog_comments for update
  using (auth.uid() = user_id);

-- Users can delete their own comments
create policy "blog_comments_delete_own"
  on public.blog_comments for delete
  using (auth.uid() = user_id);

-- Create indexes for better performance
create index if not exists blogs_author_id_idx on public.blogs(author_id);
create index if not exists blogs_published_idx on public.blogs(published);
create index if not exists blogs_created_at_idx on public.blogs(created_at desc);
create index if not exists blog_likes_blog_id_idx on public.blog_likes(blog_id);
create index if not exists blog_likes_user_id_idx on public.blog_likes(user_id);
create index if not exists blog_comments_blog_id_idx on public.blog_comments(blog_id);
create index if not exists blog_comments_user_id_idx on public.blog_comments(user_id);

-- Create function to update updated_at timestamp
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

-- Create triggers for updated_at
drop trigger if exists blogs_updated_at on public.blogs;
create trigger blogs_updated_at
  before update on public.blogs
  for each row
  execute function public.handle_updated_at();

drop trigger if exists blog_comments_updated_at on public.blog_comments;
create trigger blog_comments_updated_at
  before update on public.blog_comments
  for each row
  execute function public.handle_updated_at();

-- Create a view for blogs with author information and counts
create or replace view public.blogs_with_details as
select 
  b.id,
  b.title,
  b.content,
  b.excerpt,
  b.slug,
  b.published,
  b.created_at,
  b.updated_at,
  b.author_id,
  p.email as author_email,
  (select count(*) from public.blog_likes where blog_id = b.id) as likes_count,
  (select count(*) from public.blog_comments where blog_id = b.id) as comments_count
from public.blogs b
left join public.profiles p on b.author_id = p.id;
