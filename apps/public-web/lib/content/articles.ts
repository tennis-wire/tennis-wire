import { gatewayOrigin } from '@/lib/gateway/client'

import type { Tag } from './tags'

export type ArticleType = 'news' | 'article'

// The part of content-service's ArticleResponse this app draws
export type Article = {
    id: string
    type: ArticleType
    slug: string
    title: string
    subtitle: string | null
    content: string
    coverImageUrl: string | null
    // minutes, filled in for a material; a news item has none
    readingTime: number | null
    sourceUrl: string | null
    sourceName: string | null
    tags: Tag[]
    publishedAt: string
}

export function articleHref(article: Pick<Article, 'type' | 'slug'>): string {
    const slug = encodeURIComponent(article.slug)
    return article.type === 'news' ? `/news/${slug}` : `/materials/${slug}`
}

// Read on the server, straight from the gateway. No session and no cookie go into this, so the
// page stays cacheable: a minute of ISR, refreshed on the next request after.
export async function fetchArticle(slug: string): Promise<Article | null> {
    const response = await fetch(
        `${gatewayOrigin()}/api/public/articles/${encodeURIComponent(slug)}`,
        { headers: { accept: 'application/json' }, next: { revalidate: 60 } }
    )
    if (response.status === 404) return null
    if (!response.ok) throw new Error(`article ${slug}: gateway answered ${response.status}`)
    return (await response.json()) as Article
}
