import type { MetadataRoute } from 'next'

import { appOrigin } from '@/lib/auth/config'
import { articleHref } from '@/lib/content/articles'
import { fetchSitemapEntries } from '@/lib/content/sitemap'

// Drawn per request, not at build: the address is the stand's, and the articles change
export const dynamic = 'force-dynamic'

// The front page and every article. The lists and tag pages come in once they are more than
// placeholders. Past 50 000 articles this becomes an index of several files.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const origin = appOrigin()
    const articles = await fetchSitemapEntries()
    return [
        { url: `${origin}/` },
        ...articles.map((entry) => ({
            url: `${origin}${articleHref(entry)}`,
            lastModified: entry.revisedAt ?? entry.publishedAt,
        })),
    ]
}
