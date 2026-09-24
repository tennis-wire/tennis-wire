'use client'

import { useReaderSession } from '@/components/auth/ReaderSessionProvider'
import AuthorComments from '@/components/discussion/AuthorComments'
import { strings } from '@/components/discussion/strings'
import { muted } from '@/components/discussion/styles'

const box: React.CSSProperties = { padding: '24px 28px 32px', maxWidth: 720 }
const text: React.CSSProperties = {
    ...muted,
    color: 'var(--tw-text-secondary)',
    fontSize: 14,
    margin: 0,
}

export default function AuthoredPage() {
    const { session } = useReaderSession()

    if (session === null) return <p style={{ ...text, ...box }}>{strings.loading}</p>
    if (!session.authenticated) return null

    return (
        <div style={box}>
            <h1 style={{ fontFamily: 'var(--tw-font-display)', fontSize: 22, margin: '0 0 4px' }}>
                {strings.authored}
            </h1>
            <p style={{ ...text, margin: '0 0 20px' }}>{strings.authoredAbout}</p>
            {session.userId ? (
                <AuthorComments authorId={session.userId} empty={strings.authoredEmpty} />
            ) : (
                // signed in, but user-service did not say who: there is no author to list by
                <p style={text}>{strings.loadFailed}</p>
            )}
        </div>
    )
}
