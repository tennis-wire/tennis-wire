'use client'

import { useEffect, useState } from 'react'

type SessionInfo =
    | { authenticated: false }
    | { authenticated: true; displayName: string | null; displayNameChosen: boolean }

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
    // Empty on the server and on the first client render, filled in after
    // mount. Reading the cookie during render would make every page dynamic,
    // and guessing would give the theme toggle's hydration mismatch.
    const [session, setSession] = useState<SessionInfo | null>(null)

    useEffect(() => {
        let live = true
        fetch('/api/auth/session')
            .then((response) => response.json())
            .then((info: SessionInfo) => live && setSession(info))
            .catch(() => live && setSession({ authenticated: false }))
        return () => {
            live = false
        }
    }, [])

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
