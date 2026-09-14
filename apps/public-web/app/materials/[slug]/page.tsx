import type { Metadata } from 'next'

import ArticlePage from '@/components/content/ArticlePage'
import { fetchArticle } from '@/lib/content/articles'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params
    const article = await fetchArticle(slug)
    return { title: article ? `${article.title} — Tennis Wire` : 'Tennis Wire' }
}

export default async function MaterialPage({ params }: Props) {
    const { slug } = await params
    return <ArticlePage slug={slug} type="article" />
}
