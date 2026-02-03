"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { Heart, MessageSquare, Calendar, User, ArrowLeft, Send, Edit } from "lucide-react"
import Link from "next/link"

interface BlogDetailClientProps {
  slug: string
}

export default function BlogDetailClient({ slug }: BlogDetailClientProps) {
  const [blog, setBlog] = useState<any>(null)
  const [comments, setComments] = useState<any[]>([])
  const [newComment, setNewComment] = useState("")
  const [isLiked, setIsLiked] = useState(false)
  const [likesCount, setLikesCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadBlogAndComments()
    checkAuth()
  }, [slug])

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)
  }

  const loadBlogAndComments = async () => {
    // Load blog
    const { data: blogData } = await supabase
      .from("blogs_with_details")
      .select("*")
      .eq("slug", slug)
      .eq("published", true)
      .single()

    if (blogData) {
      setBlog(blogData)
      setLikesCount(blogData.likes_count || 0)
    }

    // Load comments with user info
    const { data: commentsData } = await supabase
      .from("blog_comments")
      .select(`
        *,
        profiles:user_id (email)
      `)
      .eq("blog_id", blogData?.id)
      .order("created_at", { ascending: false })

    if (commentsData) {
      setComments(commentsData)
    }

    // Check if user has liked
    const { data: { user } } = await supabase.auth.getUser()
    if (user && blogData) {
      const { data: likeData } = await supabase
        .from("blog_likes")
        .select("*")
        .eq("blog_id", blogData.id)
        .eq("user_id", user.id)
        .single()

      setIsLiked(!!likeData)
    }

    setLoading(false)
  }

  const handleLike = async () => {
    if (!user) {
      router.push("/")
      return
    }

    if (isLiked) {
      // Unlike
      await supabase
        .from("blog_likes")
        .delete()
        .eq("blog_id", blog.id)
        .eq("user_id", user.id)

      setIsLiked(false)
      setLikesCount(likesCount - 1)
    } else {
      // Like
      await supabase
        .from("blog_likes")
        .insert({
          blog_id: blog.id,
          user_id: user.id,
        })

      setIsLiked(true)
      setLikesCount(likesCount + 1)
    }
  }

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) {
      router.push("/")
      return
    }

    if (!newComment.trim()) return

    const { data, error } = await supabase
      .from("blog_comments")
      .insert({
        blog_id: blog.id,
        user_id: user.id,
        content: newComment,
      })
      .select(`
        *,
        profiles:user_id (email)
      `)
      .single()

    if (!error && data) {
      setComments([data, ...comments])
      setNewComment("")
    }
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0f0f0f] to-[#1a1a1a] flex items-center justify-center">
        <p className="text-white">Loading...</p>
      </div>
    )
  }

  if (!blog) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0f0f0f] to-[#1a1a1a] flex items-center justify-center">
        <div className="text-center">
          <p className="text-white text-xl mb-4">Blog post not found</p>
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
      <div className="container mx-auto px-4 py-24 max-w-4xl">
        <Link href="/blogs">
          <Button variant="outline" className="mb-6 border-white/20 text-black hover:bg-white/10">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Blogs
          </Button>
        </Link>

        <Card className="bg-black/80 backdrop-blur-sm border-white/10 mb-8">
          <CardContent className="p-8">
            <div className="flex justify-between items-start mb-4">
              <h1 className="text-4xl font-bold text-white flex-1">{blog.title}</h1>
              {user && blog.author_id === user.id && (
                <Link href={`/blogs/edit/${blog.slug}`}>
                  <Button variant="outline" size="sm" className="border-white/20 text-white hover:bg-white/10">
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                </Link>
              )}
            </div>
            
            <div className="flex items-center gap-6 text-sm text-gray-400 mb-6 pb-6 border-b border-white/10">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <span>{blog.author_email.split("@")[0]}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>{formatDate(blog.created_at)}</span>
              </div>
            </div>

            <div className="prose prose-invert max-w-none mb-8">
              <p className="text-gray-300 whitespace-pre-wrap">{blog.content}</p>
            </div>

            <div className="flex items-center gap-4 pt-6 border-t border-white/10">
              {user ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLike}
                  className={`border-white/20 hover:bg-white/10 ${
                    isLiked ? "bg-red-500/20 text-red-400" : "text-white"
                  }`}
                >
                  <Heart className={`h-4 w-4 mr-2 ${isLiked ? "fill-current" : ""}`} />
                  {likesCount} Likes
                </Button>
              ) : (
                <div className="flex items-center gap-2 text-gray-400">
                  <Heart className="h-4 w-4" />
                  <span>{likesCount} Likes</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-gray-400">
                <MessageSquare className="h-4 w-4" />
                <span>{comments.length} Comments</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Comments Section */}
        <Card className="bg-black/80 backdrop-blur-sm border-white/10">
          <CardContent className="p-8">
            <h2 className="text-2xl font-bold text-white mb-6">Comments</h2>

            {user ? (
              <form onSubmit={handleCommentSubmit} className="mb-8">
                <div className="space-y-2">
                  <Label htmlFor="comment" className="text-white">
                    Add a comment
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="comment"
                      type="text"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Share your thoughts..."
                      className="bg-black/50 border-white/20 text-white flex-1"
                    />
                    <Button type="submit" className="bg-white text-black hover:bg-gray-100">
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </form>
            ) : (
              <div className="mb-8 p-4 bg-white/5 rounded-lg border border-white/10">
                <p className="text-gray-400 text-sm">
                  Please{" "}
                  <Link href="/" className="text-blue-400 hover:text-blue-300">
                    sign in
                  </Link>{" "}
                  to comment
                </p>
              </div>
            )}

            <div className="space-y-4">
              {comments.length > 0 ? (
                comments.map((comment) => (
                  <div key={comment.id} className="p-4 bg-white/5 rounded-lg border border-white/10">
                    <div className="flex items-center gap-2 mb-2">
                      <User className="h-4 w-4 text-gray-400" />
                      <span className="text-sm font-semibold text-white">
                        {comment.profiles?.email.split("@")[0]}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatDate(comment.created_at)}
                      </span>
                    </div>
                    <p className="text-gray-300">{comment.content}</p>
                  </div>
                ))
              ) : (
                <p className="text-gray-400 text-center py-8">No comments yet. Be the first to comment!</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
