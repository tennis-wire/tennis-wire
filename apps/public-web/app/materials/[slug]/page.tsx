import type { Metadata } from 'next'

import ArticlePage from '@/components/content/ArticlePage'
import { metadataForArticle } from '@/lib/content/seo'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    return metadataForArticle((await params).slug, 'article')
}

export default async function MaterialPage({ params }: Props) {
    const { slug } = await params
    return <ArticlePage slug={slug} type="article" />
}
