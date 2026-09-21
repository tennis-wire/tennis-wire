import type { Metadata } from 'next'

import ArticlePage from '@/components/content/ArticlePage'
import { fetchArticle } from '@/lib/content/articles'

type Props = { params: Promise<{ slug: string }> }

// The same fetch as the page below; Next serves the second call from the first
export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params
    const article = await fetchArticle(slug)
    if (!article) return { title: 'Tennis Wire' }
    return {
        title: `${article.title} — Tennis Wire`,
        description: article.subtitle ?? undefined,
        openGraph: {
            title: article.title,
            description: article.subtitle ?? undefined,
            images: article.coverImageUrl ? [article.coverImageUrl] : undefined,
        },
    }
}

export default async function NewsArticlePage({ params }: Props) {
    const { slug } = await params
    return <ArticlePage slug={slug} type="news" />
}
