'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { useReaderSession } from '@/components/auth/ReaderSessionProvider'
import { countByAuthor } from '@/lib/discussion/endpoints'

const muted: React.CSSProperties = { color: 'var(--tw-text-muted)', fontSize: 14 }

const full = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })

const row: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 16,
    padding: '14px 0',
    borderTop: '1px solid var(--tw-border)',
    fontSize: 15,
}

// What the rest of the site sees. Nothing is changed from here: deleting the account and changing
// the name live one tab over, and the reader is told where.
export default function ProfilePage() {
    const { session } = useReaderSession()
    const authorId = session?.authenticated ? session.userId : null
    const [count, setCount] = useState<number | null>(null)

    useEffect(() => {
        if (!authorId) return
        let live = true
        countByAuthor(authorId)
            .then((answer) => {
                if (live) setCount(answer.count)
            })
            // a count that did not come leaves the dash in place
            .catch(() => undefined)
        return () => {
            live = false
        }
    }, [authorId])

    if (session === null) return <p style={{ ...muted, padding: '24px 28px' }}>Загрузка…</p>
    if (!session.authenticated) return null

    return (
        <div style={{ padding: '24px 28px 32px', maxWidth: 560 }}>
            <h1 style={{ fontFamily: 'var(--tw-font-display)', fontSize: 22, margin: '0 0 4px' }}>
                Профиль
            </h1>
            <p style={{ ...muted, margin: '0 0 20px' }}>Так вас видят другие читатели.</p>

            <div style={{ ...row, borderTop: 'none' }}>
                <span style={muted}>Имя</span>
                <span>{session.displayName ?? '—'}</span>
            </div>
            <div style={row}>
                <span style={muted}>На сайте</span>
                <span>
                    {session.createdAt ? `с ${full.format(new Date(session.createdAt))}` : '—'}
                </span>
            </div>
            <div style={row}>
                <span style={muted}>Комментарии</span>
                {count === null ? (
                    <span>—</span>
                ) : (
                    <Link href="/me/comments" style={{ color: 'var(--tw-primary)' }}>
                        {count}
                    </Link>
                )}
            </div>
            <div style={row}>
                <span style={muted}>Фото</span>
                <span style={muted}>пока не загружается</span>
            </div>

            <p style={{ ...muted, marginTop: 24 }}>
                Сменить имя и удалить аккаунт можно в{' '}
                <Link href="/me/settings/actions" style={{ color: 'var(--tw-primary)' }}>
                    настройках
                </Link>
                .
            </p>
        </div>
    )
}
