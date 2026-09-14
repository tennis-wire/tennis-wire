'use client'

import { useReaderSession } from './ReaderSessionProvider'

const slot: React.CSSProperties = {
    marginLeft: 8,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    minWidth: 60,
    justifyContent: 'flex-end',
    flexShrink: 0,
}

const link: React.CSSProperties = {
    fontSize: 13,
    color: 'var(--tw-text)',
    textDecoration: 'none',
    whiteSpace: 'nowrap',
}

const button: React.CSSProperties = {
    ...link,
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    color: 'var(--tw-text-muted)',
}

export default function ReaderMenu() {
    const { session } = useReaderSession()

    if (!session) return <span style={slot} />

    if (!session.authenticated) {
        return (
            <span style={slot}>
                <a href="/api/auth/login" style={link}>
                    Войти
                </a>
            </span>
        )
    }

    return (
        <form method="post" action="/api/auth/logout" style={slot}>
            <span style={{ ...link, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {session.displayName ?? 'Читатель'}
            </span>
            <button type="submit" style={button}>
                Выйти
            </button>
        </form>
    )
}
