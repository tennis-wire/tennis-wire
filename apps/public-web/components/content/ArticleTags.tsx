import Link from 'next/link'

import { tagHref, type Tag } from '@/lib/content/tags'

const chip: React.CSSProperties = {
    display: 'inline-block',
    padding: '4px 12px',
    borderRadius: 999,
    background: 'var(--tw-tag)',
    color: 'var(--tw-primary)',
    fontSize: 13,
    fontWeight: 600,
    lineHeight: 1.4,
}

// Players, tournaments, organisations and topics, in the order content-service sorts them. The
// sections are the rubric line in ArticleHead, not a tag among tags.
export default function ArticleTags({ tags }: { tags: Tag[] }) {
    const shown = tags.filter((tag) => tag.type !== 'section')
    if (shown.length === 0) return null

    return (
        <nav
            aria-label="Теги"
            style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '28px 0' }}
        >
            {shown.map((tag) => (
                <Link key={tag.id} href={tagHref(tag)} style={chip}>
                    {tag.name}
                </Link>
            ))}
        </nav>
    )
}
