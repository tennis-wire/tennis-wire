import { splitLinks } from '@/lib/discussion/text'

import { strings } from './strings'

const text: React.CSSProperties = {
    margin: '6px 0 0',
    fontSize: 16,
    lineHeight: 1.55,
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
}

export const placeholder: React.CSSProperties = {
    ...text,
    color: 'var(--tw-text-muted)',
    fontStyle: 'italic',
}

// Plain text with the links drawn; the rest is left exactly as written
export default function CommentBody({ body }: { body: string }) {
    return (
        <p style={text}>
            {splitLinks(body).map((part, index) =>
                part.kind === 'text' ? (
                    part.text
                ) : (
                    <a
                        key={index}
                        href={part.href}
                        rel="ugc nofollow noopener"
                        style={{ color: 'var(--tw-primary)' }}
                    >
                        {part.href}
                    </a>
                )
            )}
        </p>
    )
}

export function Placeholder({ children }: { children: string }) {
    return <p style={placeholder}>{children}</p>
}

export function placeholderFor(visibility: 'gravestone' | 'deleted' | 'removed'): string {
    switch (visibility) {
        case 'gravestone':
            return strings.hidden
        case 'deleted':
            return strings.deleted
        case 'removed':
            return strings.removed
    }
}
