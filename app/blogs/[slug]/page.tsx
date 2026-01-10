import BlogDetailClient from "./blog-detail-client"

export default function BlogDetailPage({ params }: { params: { slug: string } }) {
  return <BlogDetailClient slug={params.slug} />
}
