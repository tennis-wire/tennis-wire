import Link from 'next/link'

import { formatDay } from '@/components/discussion/format'
import { articleHref, type ArticleSummary } from '@/lib/content/articles'

const KIND: Record<ArticleSummary['type'], string> = { news: 'Новость', article: 'Материал' }

const slash = <span style={{ color: 'var(--tw-border)' }}>/</span>

// The row the news feed on the front page has, fed by content-service. A cover, where there is
// one, stands small to the right: the title still leads.
export default function ArticleList({ articles }: { articles: ArticleSummary[] }) {
    return (
        <div style={{ borderBottom: '1px solid var(--tw-border)' }}>
            {articles.map((article) => (
                <Link
                    key={article.id}
                    href={articleHref(article)}
                    style={{
                        display: 'flex',
                        gap: 16,
                        alignItems: 'flex-start',
                        padding: '16px 0',
                        borderTop: '1px solid var(--tw-border)',
                        color: 'var(--tw-text)',
                        textDecoration: 'none',
                    }}
                >
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                            style={{
                                fontSize: 19,
                                fontWeight: 600,
                                lineHeight: 1.3,
                                maxWidth: '64ch',
                            }}
                        >
                            {article.title}
                        </div>
                        {article.subtitle && (
                            <div
                                style={{
                                    fontSize: 15,
                                    lineHeight: 1.45,
                                    color: 'var(--tw-text-secondary)',
                                    marginTop: 4,
                                }}
                            >
                                {article.subtitle}
                            </div>
                        )}
                        <div
                            style={{
                                display: 'flex',
                                gap: 10,
                                fontSize: 13,
                                color: 'var(--tw-text-secondary)',
                                marginTop: 6,
                            }}
                        >
                            <time dateTime={article.publishedAt}>
                                {formatDay(article.publishedAt)}
                            </time>
                            {slash}
                            <span>{KIND[article.type]}</span>
                        </div>
                    </div>
                    {article.coverImageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={article.coverImageUrl}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            style={{
                                width: 120,
                                height: 80,
                                flexShrink: 0,
                                objectFit: 'cover',
                                borderRadius: 8,
                                display: 'block',
                            }}
                        />
                    )}
                </Link>
            ))}
        </div>
    )
}
