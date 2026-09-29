import Link from 'next/link'

import LocalDay from '@/components/LocalDay'
import type { Article } from '@/lib/content/articles'
import { CREDIT_LABEL } from '@/lib/content/credits'
import { tagHref } from '@/lib/content/tags'

const meta: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px 14px',
    fontSize: 14,
    color: 'var(--tw-text-muted)',
}

function readingTime(minutes: number): string {
    const last = minutes % 10
    const teen = minutes % 100 >= 11 && minutes % 100 <= 14
    const word =
        last === 1 && !teen ? 'минута' : last >= 2 && last <= 4 && !teen ? 'минуты' : 'минут'
    return `${minutes} ${word} чтения`
}

// Everything above the body: the rubric, the title, what the editor wrote under it, when and
// from where, and the cover. The tags themselves stand under the body, see ArticleTags.
export default function ArticleHead({ article }: { article: Article }) {
    const sections = article.tags.filter((tag) => tag.type === 'section')

    return (
        <header style={{ marginBottom: article.coverImageUrl ? 40 : 24 }}>
            <div style={{ maxWidth: 760, margin: '0 auto' }}>
                {sections.length > 0 && (
                    <div
                        style={{
                            display: 'flex',
                            gap: 12,
                            marginBottom: 10,
                            fontSize: 13,
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: 0.6,
                        }}
                    >
                        {sections.map((tag) => (
                            <Link key={tag.id} href={tagHref(tag)}>
                                {tag.name}
                            </Link>
                        ))}
                    </div>
                )}
                <h1
                    style={{
                        fontSize: 36,
                        lineHeight: 1.15,
                        margin: '0 0 12px',
                    }}
                >
                    {article.title}
                </h1>
                {article.subtitle && (
                    <p
                        style={{
                            fontSize: 20,
                            lineHeight: 1.4,
                            color: 'var(--tw-text-secondary)',
                            margin: '0 0 14px',
                        }}
                    >
                        {article.subtitle}
                    </p>
                )}
                <div style={meta}>
                    <LocalDay iso={article.publishedAt} />
                    {article.readingTime != null && article.readingTime > 0 && (
                        <span>{readingTime(article.readingTime)}</span>
                    )}
                    {article.sourceName && (
                        <span>
                            Источник:{' '}
                            {article.sourceUrl ? (
                                <a href={article.sourceUrl} rel="noopener nofollow">
                                    {article.sourceName}
                                </a>
                            ) : (
                                article.sourceName
                            )}
                        </span>
                    )}
                </div>
            </div>
            {article.coverImageUrl && <Cover article={article} />}
        </header>
    )
}

// Wider than the text and cut to 16:9, see .tw-cover. Caption and credit are each optional, and
// with neither there is no figcaption: nothing stands under the picture.
function Cover({ article }: { article: Article }) {
    const { coverCaption: caption, coverCredit: credit } = article
    return (
        <figure className="tw-cover">
            {/* Straight from the media bucket, as the avatars are. next/image would need the
                bucket's host in next.config, which differs between stands. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={article.coverImageUrl ?? undefined}
                alt={article.coverAlt ?? ''}
                fetchPriority="high"
            />
            {(caption || credit) && (
                <figcaption style={{ maxWidth: 760 }}>
                    {caption && <span data-caption="">{caption}</span>}
                    {credit && (
                        <span data-credit={article.coverCreditKind ?? 'photo'}>
                            {CREDIT_LABEL[article.coverCreditKind ?? 'photo']}: {credit}
                        </span>
                    )}
                </figcaption>
            )}
        </figure>
    )
}
