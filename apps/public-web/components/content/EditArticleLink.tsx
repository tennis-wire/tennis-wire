'use client'

import { useReaderSession } from '@/components/auth/ReaderSessionProvider'

// For staff only, and drawn after the session answers, so the cached HTML stays the same for
// everyone. Opens the editor in its own tab: it is a separate app with its own sign-in.
// Whether the person may really edit this article is the editor's and the server's to say.
export default function EditArticleLink({ articleId }: { articleId: string }) {
    const { session } = useReaderSession()
    if (!session?.authenticated || !session.editorialOrigin) return null

    return (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
            <a
                href={`${session.editorialOrigin}/editor/${encodeURIComponent(articleId)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: 'var(--tw-primary)',
                    border: '1px solid var(--tw-primary)',
                    borderRadius: 6,
                    padding: '4px 12px',
                    textDecoration: 'none',
                }}
            >
                Редактировать
            </a>
        </div>
    )
}
