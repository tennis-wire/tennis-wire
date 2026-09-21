import { gatewayOrigin } from '@/lib/gateway/client'

import type { ArticleSummary, ArticleType } from './articles'

export type TagType = 'player' | 'tournament' | 'organization' | 'topic' | 'section'

export type Tag = {
    id: string
    name: string
    slug: string
    type: TagType
}

// A section is a rubric with a page of its own; every other tag lists what carries it
export function tagHref(tag: Pick<Tag, 'slug' | 'type'>): string {
    const slug = encodeURIComponent(tag.slug)
    return tag.type === 'section' ? `/sections/${slug}` : `/tags/${slug}`
}

export type TagPage = {
    tag: Tag & { description: string | null }
    articles: {
        content: ArticleSummary[]
        // Spring's Page, serialised via DTO: the numbers sit under page
        page: { size: number; number: number; totalElements: number; totalPages: number }
    }
}

// One tag and a page of what carries it; page counts from zero, as the service does
export async function fetchTagPage(
    slug: string,
    type: ArticleType | null,
    page: number
): Promise<TagPage | null> {
    const query = new URLSearchParams({ page: String(page) })
    if (type) query.set('type', type)
    const response = await fetch(
        `${gatewayOrigin()}/api/public/tags/${encodeURIComponent(slug)}?${query}`,
        { headers: { accept: 'application/json' }, next: { revalidate: 60 } }
    )
    if (response.status === 404) return null
    if (!response.ok) throw new Error(`tag ${slug}: gateway answered ${response.status}`)
    return (await response.json()) as TagPage
}
