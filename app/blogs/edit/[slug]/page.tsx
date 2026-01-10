"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

interface EditBlogPageProps {
  params: { slug: string }
}

export default function EditBlogPage({ params }: EditBlogPageProps) {
  const [title, setTitle] = useState("")
  const [excerpt, setExcerpt] = useState("")
  const [content, setContent] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [blogId, setBlogId] = useState("")
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadBlog()
  }, [params.slug])

  const loadBlog = async () => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push("/blogs")
        return
      }

      // Fetch the blog
      const { data: blog, error } = await supabase
        .from("blogs")
        .select("*")
        .eq("slug", params.slug)
        .single()

      if (error || !blog) {
        setError("Blog not found")
        setLoading(false)
        return
      }

      // Check if user is the author
      if (blog.author_id !== user.id) {
        setError("You don't have permission to edit this blog")
        setLoading(false)
        return
      }

      setBlogId(blog.id)
      setTitle(blog.title)
      setExcerpt(blog.excerpt || "")
      setContent(blog.content)
      setLoading(false)
    } catch (err) {
      setError("Failed to load blog")
      setLoading(false)
    }
  }

  const generateSlug = (text: string) => {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSaving(true)

    try {
      const slug = generateSlug(title)

      const { error: updateError } = await supabase
        .from("blogs")
        .update({
          title,
          excerpt,
          content,
          slug,
        })
        .eq("id", blogId)

      if (updateError) {
        setError(updateError.message)
        setSaving(false)
        return
      }

      router.push(`/blogs/${slug}`)
    } catch (err) {
      setError("An unexpected error occurred")
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0f0f0f] to-[#1a1a1a] flex items-center justify-center">
        <p className="text-white">Loading...</p>
      </div>
    )
  }

  if (error && !title) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0f0f0f] to-[#1a1a1a] flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-xl mb-4">{error}</p>
          <Link href="/blogs">
            <Button className="bg-white text-black hover:bg-gray-100">
              Back to Blogs
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0f0f0f] to-[#1a1a1a]">
      <div className="container mx-auto px-4 py-24 max-w-3xl">
        <Link href={`/blogs/${params.slug}`}>
          <Button variant="outline" className="mb-6 border-white/20 text-white hover:bg-white/10">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Blog
          </Button>
        </Link>

        <Card className="bg-black/80 backdrop-blur-sm border-white/10">
          <CardHeader>
            <CardTitle className="text-3xl text-white">Edit Blog Post</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="title" className="text-white">
                  Title
                </Label>
                <Input
                  id="title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="bg-black/50 border-white/20 text-white"
                  placeholder="Enter your blog title"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="excerpt" className="text-white">
                  Excerpt
                </Label>
                <Input
                  id="excerpt"
                  type="text"
                  value={excerpt}
                  onChange={(e) => setExcerpt(e.target.value)}
                  className="bg-black/50 border-white/20 text-white"
                  placeholder="A short description of your blog post"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="content" className="text-white">
                  Content
                </Label>
                <textarea
                  id="content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  required
                  rows={12}
                  className="w-full px-3 py-2 bg-black/50 border border-white/20 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-white/20"
                  placeholder="Write your blog content here..."
                />
              </div>

              <Button
                type="submit"
                disabled={saving}
                className="w-full bg-white text-black hover:bg-gray-100"
              >
                {saving ? "Saving..." : "Update Post"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
