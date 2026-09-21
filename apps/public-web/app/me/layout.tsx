'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import Avatar from '@/components/Avatar'
import { useReaderSession } from '@/components/auth/ReaderSessionProvider'

// Appearance is kept by the browser rather than the account, so the cabinet opens for a stranger
// too, with one tab in it.
const TABS = [
    { href: '/me', label: 'Профиль', account: true },
    { href: '/me/comments', label: 'Комментарии', account: true },
    { href: '/me/settings', label: 'Настройки', account: false },
]

// Month and year only, but in the genitive the phrase needs. Intl gives that form of the month
// only next to a day, so the date is formatted with one and the day left out
const dated = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })

function since(iso: string): string {
    const parts = dated.formatToParts(new Date(iso))
    const part = (type: Intl.DateTimeFormatPartTypes) =>
        parts.find((p) => p.type === type)?.value ?? ''
    return `с ${part('month')} ${part('year')} г.`
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

const tab: React.CSSProperties = {
    padding: '14px 2px',
    fontSize: 14,
    textDecoration: 'none',
    whiteSpace: 'nowrap',
    borderBottom: '2px solid transparent',
}

export default function CabinetLayout({ children }: { children: React.ReactNode }) {
    const { session } = useReaderSession()
    const pathname = usePathname()

    const signedIn = session?.authenticated === true
    const displayName = session?.authenticated ? session.displayName : null
    const createdAt = session?.authenticated ? session.createdAt : null
    const photo = session?.authenticated ? session.avatarLargeUrl : null

    return (
        <div style={card}>
            <div style={strip}>
                <Avatar name={displayName} src={photo} size={56} />
                <div style={{ minWidth: 0 }}>
                    <div
                        style={{
                            fontFamily: 'var(--tw-font-display)',
                            fontSize: 24,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                        }}
                    >
                        {signedIn ? (displayName ?? 'Читатель') : 'Личный кабинет'}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--tw-text-muted)', marginTop: 3 }}>
                        {signedIn
                            ? createdAt
                                ? since(createdAt)
                                : 'ваш аккаунт и настройки'
                            : 'настройки этого браузера'}
                    </div>
                </div>
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
                            style={{
                                ...tab,
                                fontWeight: active ? 600 : 400,
                                color: active ? 'var(--tw-text)' : 'var(--tw-text-secondary)',
                                borderBottomColor: active ? 'var(--tw-primary)' : 'transparent',
                            }}
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
