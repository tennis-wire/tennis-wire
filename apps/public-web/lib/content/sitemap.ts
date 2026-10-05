import { gatewayOrigin } from '@/lib/gateway/client'

import type { ArticleType } from './articles'

// content-service's SitemapEntryResponse: every published article, newest first
export type SitemapEntry = {
    type: ArticleType
    slug: string
    publishedAt: string
    revisedAt: string | null
}

// A new article reaches the sitemap within five minutes, which is what a crawler needs to hear
// of it soon; the list is a single light query on the service's side
export async function fetchSitemapEntries(): Promise<SitemapEntry[]> {
    const response = await fetch(`${gatewayOrigin()}/api/public/sitemap/articles`, {
        headers: { accept: 'application/json' },
        next: { revalidate: 300 },
    })
    if (!response.ok) throw new Error(`sitemap: gateway answered ${response.status}`)
    return (await response.json()) as SitemapEntry[]
}
