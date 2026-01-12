import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import { Navbar } from "@/components/ui/navbar"
import { Button } from "@/components/ui/button"
import { BlogCard } from "@/components/blog-card"
import { BlogsClient } from "./blogs-client"
import { ArrowRight, Lock } from "lucide-react"
import Link from "next/link"

export default async function BlogsPage() {
  const supabase = await createClient()

  const { data } = await supabase.auth.getUser()
  const isAuthenticated = !!data?.user

  // Get username from profile
  let username = "User"
  if (isAuthenticated && data?.user?.id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", data.user.id)
      .single()
    
    if (profile?.username) {
      username = profile.username
    }
  }

  // Fetch blogs - limited to 3 for unauthenticated users
  const query = supabase
    .from("blogs_with_details")
    .select("*")
    .eq("published", true)
    .order("created_at", { ascending: false })

  if (!isAuthenticated) {
    query.limit(3)
  }

  const { data: blogs } = await query

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0f0f0f] to-[#1a1a1a]">
      <Suspense fallback={<div className="h-20" />}>
        <Navbar />
      </Suspense>

      <div className="container mx-auto px-4 py-24">
        {isAuthenticated && <BlogsClient username={username} />}

        {!isAuthenticated && (
          <div className="mb-8 p-6 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <div className="flex items-start gap-4">
              <Lock className="h-6 w-6 text-blue-400 mt-1 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-2">
                  Sign up to unlock full access
                </h3>
                <p className="text-gray-300 mb-4">
                  You're viewing the latest 3 blog posts. Sign up or log in to access all blogs, create your own posts, like, and comment on articles.
                </p>
                <div className="flex gap-3">
                  <Link href="/?signup=true">
                    <Button className="bg-white text-black hover:bg-gray-100">
                      Sign Up
                    </Button>
                  </Link>
                  <Link href="/?login=true">
                    <Button variant="outline" className="border-white/20 bg-white text-black hover:bg-gray-100">
                      Log In
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center mb-12">
          <div>
            <h1 className="text-4xl font-bold text-white mb-4">AI Insights & Articles</h1>
            <p className="text-gray-400">
              {isAuthenticated 
                ? "Explore the latest in AI as a Service" 
                : "Discover our latest AI insights (Showing 3 most recent)"}
            </p>
          </div>
          {isAuthenticated && (
            <Link href="/blogs/create">
              <Button className="bg-white text-black hover:bg-gray-100">
                Create New Post
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          )}
        </div>

        {blogs && blogs.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {blogs.map((blog: any) => (
              <BlogCard
                key={blog.id}
                id={blog.id}
                title={blog.title}
                excerpt={blog.excerpt || blog.content.substring(0, 150) + "..."}
                author_email={blog.author_email}
                created_at={blog.created_at}
                likes_count={blog.likes_count || 0}
                comments_count={blog.comments_count || 0}
                slug={blog.slug}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-black/50 rounded-lg border border-white/10">
            <p className="text-gray-400 text-lg">No blog posts yet. Be the first to share your insights!</p>
            {isAuthenticated && (
              <Link href="/blogs/create">
                <Button className="bg-white text-black hover:bg-gray-100 mt-6">
                  Create First Post
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
