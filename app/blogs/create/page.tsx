"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function CreateBlogPage() {
  const [title, setTitle] = useState("")
  const [excerpt, setExcerpt] = useState("")
  const [content, setContent] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()

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
    setLoading(true)

    try {
      const supabase = createClient()
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        setError("You must be logged in to create a blog post")
        setLoading(false)
        return
      }

      const slug = generateSlug(title)

      const { error: insertError } = await supabase
        .from("blogs")
        .insert({
          title,
          excerpt,
          content,
          slug,
          author_id: user.id,
          published: true,
        })

      if (insertError) {
        setError(insertError.message)
        setLoading(false)
        return
      }

      router.push("/blogs")
    } catch (err) {
      setError("An unexpected error occurred")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0f0f0f] to-[#1a1a1a]">
      <div className="container mx-auto px-4 py-24 max-w-3xl">
        <Link href="/blogs">
          <Button variant="outline" className="mb-6 border-white/20 text-white hover:bg-white/10">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Blogs
          </Button>
        </Link>

        <Card className="bg-black/80 backdrop-blur-sm border-white/10">
          <CardHeader>
            <CardTitle className="text-3xl text-white">Create New Blog Post</CardTitle>
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
                disabled={loading}
                className="w-full bg-white text-black hover:bg-gray-100"
              >
                {loading ? "Publishing..." : "Publish Post"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
