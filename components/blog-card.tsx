"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Heart, MessageSquare, Calendar, User } from "lucide-react"
import Link from "next/link"

interface BlogCardProps {
  id: string
  title: string
  excerpt: string
  author_email: string
  created_at: string
  likes_count: number
  comments_count: number
  slug: string
}

export function BlogCard({
  id,
  title,
  excerpt,
  author_email,
  created_at,
  likes_count,
  comments_count,
  slug,
}: BlogCardProps) {
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  return (
    <Card className="bg-black/80 backdrop-blur-sm border-white/10 hover:border-white/20 transition-all">
      <CardContent className="p-6">
        <div className="space-y-4">
          <div>
            <Link href={`/blogs/${slug}`}>
              <h3 className="text-xl font-bold text-white hover:text-blue-400 transition-colors cursor-pointer">
                {title}
              </h3>
            </Link>
            <p className="text-gray-300 mt-2 line-clamp-3">{excerpt}</p>
          </div>

          <div className="flex items-center gap-4 text-sm text-gray-400">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span>{author_email.split("@")[0]}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>{formatDate(created_at)}</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-white/10">
            <div className="flex items-center gap-4 text-sm text-gray-400">
              <div className="flex items-center gap-2">
                <Heart className="h-4 w-4" />
                <span>{likes_count}</span>
              </div>
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                <span>{comments_count}</span>
              </div>
            </div>
            <Link href={`/blogs/${slug}`}>
              <Button variant="outline" size="sm" className="border-white/20 bg-white text-black hover:bg-gray-100">
                Read More
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
