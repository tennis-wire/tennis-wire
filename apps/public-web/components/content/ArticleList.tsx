import Link from 'next/link'

import { formatDay } from '@/components/discussion/format'
import { articleHref, type ArticleSummary } from '@/lib/content/articles'

const KIND: Record<ArticleSummary['type'], string> = { news: 'Новость', article: 'Материал' }

// The same row as the news feed on the front page, fed by content-service
export default function ArticleList({ articles }: { articles: ArticleSummary[] }) {
    return (
        <div
            style={{
                background: 'var(--tw-surface)',
                border: '1px solid var(--tw-border)',
                borderRadius: 12,
                padding: '4px 20px',
                boxShadow: 'var(--tw-card-shadow)',
            }}
        >
            {articles.map((article, i) => (
                <Link
                    key={article.id}
                    href={articleHref(article)}
                    style={{
                        display: 'flex',
                        gap: 14,
                        padding: '14px 0',
                        borderTop: i > 0 ? '1px solid var(--tw-border)' : 'none',
                        color: 'var(--tw-text)',
                    }}
                >
                    <div
                        style={{
                            width: 96,
                            height: 64,
                            flexShrink: 0,
                            borderRadius: 8,
                            overflow: 'hidden',
                            background: 'var(--tw-bg-alt)',
                        }}
                    >
                        {article.coverImageUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={article.coverImageUrl}
                                alt=""
                                loading="lazy"
                                decoding="async"
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                    display: 'block',
                                }}
                            />
                        )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.35 }}>
                            {article.title}
                        </div>
                        {article.subtitle && (
                            <div
                                style={{
                                    fontSize: 14,
                                    color: 'var(--tw-text-secondary)',
                                    marginTop: 3,
                                }}
                            >
                                {article.subtitle}
                            </div>
                        )}
                        <div
                            style={{
                                fontSize: 12,
                                color: 'var(--tw-text-muted)',
                                marginTop: 5,
                            }}
                        >
                            <time dateTime={article.publishedAt}>
                                {formatDay(article.publishedAt)}
                            </time>{' '}
                            &middot; {KIND[article.type]}
                        </div>
                    </div>
                </Link>
            ))}
        </div>
    )
}
