'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTheme } from '@/theme'
import { useState } from 'react'
import Search from '@/components/Search'

const NAV_ITEMS = [
    { label: 'Главная', href: '/' },
    { label: 'Новости', href: '/news' },
    { label: 'Материалы', href: '/materials' },
    { label: 'Live', href: '/live', live: true },
    { label: 'Турниры', href: '/tournaments' },
    { label: 'Рейтинг', href: '/rankings' },
]

const SECTIONS = [{ label: 'Треш-зона', href: '/sections/trash' }]

export default function Header() {
    const pathname = usePathname()
    const { isDark, toggleDark } = useTheme()
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
                    height: 56,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                }}
            >
                {/* Logo */}
                <Link
                    href="/"
                    style={{
                        fontFamily: 'var(--tw-font-display)',
                        fontSize: 20,
                        fontWeight: 700,
                        color: 'var(--tw-primary)',
                        textDecoration: 'none',
                        marginRight: 20,
                        flexShrink: 0,
                    }}
                >
                    Tennis Wire
                </Link>

                {/* Nav items */}
                <nav style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    {NAV_ITEMS.map((item) => {
                        const isActive =
                            item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                style={{
                                    padding: '6px 12px',
                                    borderRadius: 8,
                                    fontSize: 14,
                                    fontWeight: isActive ? 600 : 400,
                                    color: isActive
                                        ? 'var(--tw-primary)'
                                        : 'var(--tw-text-secondary)',
                                    background: isActive ? 'var(--tw-tag)' : 'transparent',
                                    textDecoration: 'none',
                                    transition: 'all 0.15s ease',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {item.label}
                                {item.live && (
                                    <span
                                        style={{
                                            width: 6,
                                            height: 6,
                                            borderRadius: '50%',
                                            background: 'var(--tw-live)',
                                            display: 'inline-block',
                                        }}
                                    />
                                )}
                            </Link>
                        )
                    })}

                    {/* Sections dropdown */}
                    <div style={{ position: 'relative' }}>
                        <button
                            onClick={() => setSectionsOpen(!sectionsOpen)}
                            style={{
                                padding: '6px 12px',
                                borderRadius: 8,
                                fontSize: 14,
                                fontWeight: 400,
                                color: 'var(--tw-text-secondary)',
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                fontFamily: 'var(--tw-font-body)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                whiteSpace: 'nowrap',
                            }}
                        >
                            Разделы ▾
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
                                        marginTop: 4,
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

                {/* Spacer */}
                <div style={{ flex: 1 }} />

                {/* Search */}
                <Search />

                {/* Theme toggle */}
                <button
                    onClick={toggleDark}
                    style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        border: '1px solid var(--tw-border)',
                        background: 'var(--tw-surface)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 16,
                        marginLeft: 8,
                        flexShrink: 0,
                    }}
                    title={isDark ? 'Светлая тема' : 'Тёмная тема'}
                >
                    {isDark ? '☀️' : '🌙'}
                </button>

                {/* Profile avatar */}
                <Link
                    href="/settings"
                    style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        background: 'var(--tw-bg-alt)',
                        border: '1px solid var(--tw-border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textDecoration: 'none',
                        fontSize: 14,
                        color: 'var(--tw-text-muted)',
                        flexShrink: 0,
                        marginLeft: 4,
                    }}
                >
                    👤
                </Link>
            </div>
        </header>
    )
}
