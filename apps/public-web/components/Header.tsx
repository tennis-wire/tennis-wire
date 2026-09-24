'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import Search from '@/components/Search'
import ReaderMenu from '@/components/auth/ReaderMenu'
import LiveTicker from '@/components/home/LiveTicker'

const NAV_ITEMS = [
    { label: 'Главная', href: '/' },
    { label: 'Новости', href: '/news' },
    { label: 'Материалы', href: '/materials' },
    { label: 'Live', href: '/live', live: true },
    { label: 'Турниры', href: '/tournaments' },
    { label: 'Рейтинг', href: '/rankings' },
]

const SECTIONS = [{ label: 'Треш-зона', href: '/sections/trash' }]

// The page the reader is on is underlined rather than filled in: the header reads as a line of
// type, not a row of buttons
const navLink = (active: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    paddingBottom: 2,
    fontSize: 15,
    fontWeight: active ? 600 : 400,
    color: active ? 'var(--tw-text)' : 'var(--tw-text-secondary)',
    borderBottom: `2px solid ${active ? 'var(--tw-primary)' : 'transparent'}`,
    textDecoration: 'none',
    whiteSpace: 'nowrap',
})

export default function Header() {
    const pathname = usePathname()
    const [sectionsOpen, setSectionsOpen] = useState(false)

    return (
        <header
            style={{
                position: 'sticky',
                top: 0,
                zIndex: 100,
                background: 'var(--tw-surface)',
                borderBottom: '1px solid var(--tw-border)',
            }}
        >
            <div
                style={{
                    maxWidth: 1200,
                    margin: '0 auto',
                    padding: '0 20px',
                    height: 64,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 26,
                }}
            >
                <Link
                    href="/"
                    style={{
                        fontFamily: 'var(--tw-font-display)',
                        fontSize: 25,
                        fontWeight: 700,
                        letterSpacing: '-0.01em',
                        color: 'var(--tw-primary)',
                        textDecoration: 'none',
                        flexShrink: 0,
                    }}
                >
                    Tennis Wire
                </Link>

                <nav style={{ display: 'flex', gap: 22, alignItems: 'center' }}>
                    {NAV_ITEMS.map((item) => {
                        const isActive =
                            item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                aria-current={isActive ? 'page' : undefined}
                                style={navLink(isActive)}
                            >
                                {item.label}
                                {item.live && (
                                    <span
                                        style={{
                                            width: 7,
                                            height: 7,
                                            borderRadius: '50%',
                                            background: 'var(--tw-live)',
                                        }}
                                    />
                                )}
                            </Link>
                        )
                    })}

                    <div style={{ position: 'relative' }}>
                        <button
                            type="button"
                            aria-expanded={sectionsOpen}
                            onClick={() => setSectionsOpen(!sectionsOpen)}
                            style={{
                                // first: the shorthand would reset the size set after it
                                font: 'inherit',
                                ...navLink(false),
                                background: 'none',
                                borderTop: 'none',
                                borderLeft: 'none',
                                borderRight: 'none',
                                padding: '0 0 2px',
                                cursor: 'pointer',
                            }}
                        >
                            Разделы&nbsp;&#9662;
                        </button>

                        {sectionsOpen && (
                            <>
                                <div
                                    style={{
                                        position: 'fixed',
                                        inset: 0,
                                        zIndex: 10,
                                    }}
                                    onClick={() => setSectionsOpen(false)}
                                />
                                <div
                                    style={{
                                        position: 'absolute',
                                        top: '100%',
                                        left: 0,
                                        marginTop: 8,
                                        background: 'var(--tw-surface)',
                                        border: '1px solid var(--tw-border)',
                                        borderRadius: 10,
                                        boxShadow: 'var(--tw-card-shadow)',
                                        padding: 6,
                                        minWidth: 180,
                                        zIndex: 20,
                                    }}
                                >
                                    {SECTIONS.map((section) => (
                                        <Link
                                            key={section.href}
                                            href={section.href}
                                            onClick={() => setSectionsOpen(false)}
                                            style={{
                                                display: 'block',
                                                padding: '8px 12px',
                                                borderRadius: 6,
                                                fontSize: 14,
                                                color: 'var(--tw-text)',
                                                textDecoration: 'none',
                                            }}
                                        >
                                            {section.label}
                                        </Link>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </nav>

                <div style={{ flex: 1 }} />

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Search />
                    <ReaderMenu />
                </div>
            </div>

            {/* The front page only: elsewhere the reader came for something else */}
            {pathname === '/' && <LiveTicker />}
        </header>
    )
}
