'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

import Avatar from '@/components/Avatar'
import { useReaderSession } from '@/components/auth/ReaderSessionProvider'
import { countByAuthor } from '@/lib/discussion/endpoints'
import { formatMonthYear } from '@/lib/format'

// One row of tabs. Appearance is kept by the browser rather than the account, so the cabinet
// opens for a stranger too, with that one tab in it.
const TABS = [
    { href: '/me', label: 'Профиль', account: true },
    { href: '/me/comments', label: 'Комментарии', account: true },
    { href: '/me/settings/appearance', label: 'Внешний вид', account: false },
    { href: '/me/settings/ignore', label: 'Игнор-лист', account: true },
]

function commentsWord(count: number): string {
    const last = count % 10
    const teen = count % 100 >= 11 && count % 100 <= 14
    if (last === 1 && !teen) return 'комментарий'
    if (last >= 2 && last <= 4 && !teen) return 'комментария'
    return 'комментариев'
}

const card: React.CSSProperties = {
    maxWidth: 960,
    margin: '0 auto',
    background: 'var(--tw-surface)',
    border: '1px solid var(--tw-border)',
    borderRadius: 14,
    boxShadow: 'var(--tw-card-shadow)',
    overflow: 'hidden',
}

const strip: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: '24px 28px',
    background: 'var(--tw-bg-alt)',
}

const tab = (active: boolean): React.CSSProperties => ({
    padding: '14px 2px',
    fontSize: 15,
    fontWeight: active ? 600 : 400,
    color: active ? 'var(--tw-text)' : 'var(--tw-text-secondary)',
    whiteSpace: 'nowrap',
    borderBottom: `2px solid ${active ? 'var(--tw-primary)' : 'transparent'}`,
})

export default function CabinetLayout({ children }: { children: React.ReactNode }) {
    const { session } = useReaderSession()
    const pathname = usePathname()

    const signedIn = session?.authenticated === true
    const displayName = session?.authenticated ? session.displayName : null
    const createdAt = session?.authenticated ? session.createdAt : null
    const photo = session?.authenticated ? session.avatarLargeUrl : null
    const authorId = session?.authenticated ? session.userId : null

    // The one number about the reader, over every tab rather than on one of them
    const [count, setCount] = useState<number | null>(null)
    useEffect(() => {
        if (!authorId) return
        let live = true
        countByAuthor(authorId)
            .then((answer) => {
                if (live) setCount(answer.count)
            })
            // a count that did not come is simply not shown
            .catch(() => undefined)
        return () => {
            live = false
        }
    }, [authorId])

    return (
        <div style={card}>
            <div style={strip}>
                <Avatar name={displayName} src={photo} size={56} />
                <div style={{ minWidth: 0 }}>
                    <div
                        className="tw-display"
                        style={{
                            fontSize: 24,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                        }}
                    >
                        {signedIn ? (displayName ?? 'Читатель') : 'Личный кабинет'}
                    </div>
                    <div style={{ fontSize: 14, color: 'var(--tw-text-secondary)', marginTop: 3 }}>
                        {signedIn
                            ? createdAt
                                ? `с ${formatMonthYear(createdAt)}`
                                : 'ваш аккаунт и настройки'
                            : 'настройки этого браузера'}
                    </div>
                </div>
                {signedIn && count !== null && (
                    <Link
                        href="/me/comments"
                        style={{
                            marginLeft: 'auto',
                            textAlign: 'right',
                            color: 'var(--tw-text)',
                        }}
                    >
                        <div style={{ fontSize: 22, fontWeight: 700 }}>{count}</div>
                        <div style={{ fontSize: 13, color: 'var(--tw-text-secondary)' }}>
                            {commentsWord(count)}
                        </div>
                    </Link>
                )}
            </div>

            <div className="tw-tabs">
                {TABS.filter((item) => signedIn || !item.account).map((item) => {
                    const active =
                        item.href === '/me' ? pathname === '/me' : pathname.startsWith(item.href)

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            aria-current={active ? 'page' : undefined}
                            style={tab(active)}
                        >
                            {item.label}
                        </Link>
                    )
                })}
            </div>

            {children}
        </div>
    )
}
