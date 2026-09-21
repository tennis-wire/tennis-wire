import Link from 'next/link'
import { notFound } from 'next/navigation'

import type { ArticleType } from '@/lib/content/articles'
import { fetchTagPage, type TagType } from '@/lib/content/tags'

import ArticleList from './ArticleList'

const FILTERS: { type: ArticleType | null; label: string }[] = [
    { type: null, label: 'Всё' },
    { type: 'news', label: 'Новости' },
    { type: 'article', label: 'Материалы' },
]

const KIND: Record<TagType, string> = {
    player: 'Игрок',
    tournament: 'Турнир',
    organization: 'Организация',
    topic: 'Тема',
    section: 'Раздел',
}

export type FeedQuery = { type?: string; page?: string }

// What the URL says, or the default: a wrong word is the same as none
export function parseQuery(query: FeedQuery): { type: ArticleType | null; page: number } {
    const type = query.type === 'news' || query.type === 'article' ? query.type : null
    const page = Math.max(0, Math.floor(Number(query.page) || 0))
    return { type, page }
}

function href(base: string, type: ArticleType | null, page: number): string {
    const params = new URLSearchParams()
    if (type) params.set('type', type)
    if (page > 0) params.set('page', String(page))
    const query = params.toString()
    return query ? `${base}?${query}` : base
}

const pill = (active: boolean): React.CSSProperties => ({
    padding: '6px 14px',
    borderRadius: 999,
    fontSize: 14,
    fontWeight: 600,
    color: active ? 'var(--tw-surface)' : 'var(--tw-text-secondary)',
    background: active ? 'var(--tw-primary)' : 'var(--tw-tag)',
})

// A tag's page and a section's page are the same page: a name, three filters, a list. Which of
// the two a tag gets is decided by the route, so /sections/<player> is nobody's page.
export default async function TagFeed({
    slug,
    base,
    section,
    query,
}: {
    slug: string
    base: string
    section: boolean
    query: FeedQuery
}) {
    const { type, page } = parseQuery(query)
    const result = await fetchTagPage(slug, type, page)
    if (!result || (result.tag.type === 'section') !== section) notFound()

    const { tag, articles } = result
    const last = Math.max(0, articles.page.totalPages - 1)

    return (
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
            <p
                style={{
                    margin: '0 0 6px',
                    fontSize: 13,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: 0.6,
                    color: 'var(--tw-text-muted)',
                }}
            >
                {KIND[tag.type]}
            </p>
            <h1 style={{ fontFamily: 'var(--tw-font-display)', fontSize: 32, margin: '0 0 8px' }}>
                {tag.name}
            </h1>
            {tag.description && (
                <p style={{ color: 'var(--tw-text-secondary)', fontSize: 16, margin: '0 0 16px' }}>
                    {tag.description}
                </p>
            )}
            <nav aria-label="Фильтр" style={{ display: 'flex', gap: 8, margin: '16px 0 20px' }}>
                {FILTERS.map((filter) => (
                    <Link
                        key={filter.label}
                        href={href(base, filter.type, 0)}
                        style={pill(filter.type === type)}
                    >
                        {filter.label}
                    </Link>
                ))}
            </nav>
            {articles.content.length === 0 ? (
                <p style={{ color: 'var(--tw-text-muted)' }}>Пока ничего не опубликовано</p>
            ) : (
                <ArticleList articles={articles.content} />
            )}
            {last > 0 && (
                <nav
                    aria-label="Страницы"
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        margin: '20px 0',
                        fontSize: 14,
                    }}
                >
                    <span>{page > 0 && <Link href={href(base, type, page - 1)}>Новее</Link>}</span>
                    <span style={{ color: 'var(--tw-text-muted)' }}>
                        {page + 1} из {last + 1}
                    </span>
                    <span>
                        {page < last && <Link href={href(base, type, page + 1)}>Раньше</Link>}
                    </span>
                </nav>
            )}
        </div>
    )
}
