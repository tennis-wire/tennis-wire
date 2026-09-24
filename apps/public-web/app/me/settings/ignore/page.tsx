'use client'

import { useReaderSession } from '@/components/auth/ReaderSessionProvider'
import IgnoreList from '@/components/discussion/IgnoreList'
import { strings } from '@/components/discussion/strings'
import { loginHere } from '@/lib/auth/loginHref'

const muted: React.CSSProperties = { color: 'var(--tw-text-secondary)', fontSize: 14 }

export default function IgnorePage() {
    const { session } = useReaderSession()

    return (
        <div style={{ maxWidth: 680 }}>
            <h1 style={{ fontSize: 22, margin: '0 0 4px' }}>{strings.ignoreList}</h1>
            <p style={{ ...muted, margin: '0 0 20px', maxWidth: '60ch' }}>
                {strings.ignoreListAbout}
            </p>

            {session === null ? (
                <p style={muted}>{strings.loading}</p>
            ) : session.authenticated ? (
                <IgnoreList />
            ) : (
                <p style={muted}>
                    {strings.signInToIgnoreList} ·{' '}
                    <a href={loginHere()} style={{ color: 'var(--tw-primary)' }}>
                        {strings.signIn}
                    </a>
                </p>
            )}
        </div>
    )
}
