import type { Metadata } from 'next'

import ArticlePage from '@/components/content/ArticlePage'
import { metadataForArticle } from '@/lib/content/seo'

type Props = { params: Promise<{ slug: string }> }

// The same fetch as the page below; Next serves the second call from the first
export async function generateMetadata({ params }: Props): Promise<Metadata> {
    return metadataForArticle((await params).slug, 'news')
}

export default async function NewsArticlePage({ params }: Props) {
    const { slug } = await params
    return <ArticlePage slug={slug} type="news" />
}
