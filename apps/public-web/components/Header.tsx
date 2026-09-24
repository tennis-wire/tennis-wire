'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import Search from '@/components/Search'
import ReaderMenu from '@/components/auth/ReaderMenu'
import LiveTicker from '@/components/home/LiveTicker'
import { popoverPanel, usePopover } from '@/components/ui/popover'

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
    const links = useRef<HTMLDivElement>(null)
    const active = useRef<HTMLAnchorElement>(null)

    // On a phone the sections scroll sideways: the one the reader is on is brought into view
    useEffect(() => {
        const box = links.current
        const item = active.current
        if (!box || !item || box.scrollWidth <= box.clientWidth) return
        const at = item.getBoundingClientRect()
        const within = box.getBoundingClientRect()
        box.scrollLeft += at.left - within.left - (within.width - at.width) / 2
    }, [pathname])

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
            <div className="tw-header-row">
                <Link
                    href="/"
                    className="tw-display tw-logo"
                    style={{
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

                <nav className="tw-nav">
                    <div ref={links} className="tw-nav-links">
                        {NAV_ITEMS.map((item) => {
                            const isActive =
                                item.href === '/'
                                    ? pathname === '/'
                                    : pathname.startsWith(item.href)

                            return (
                                <Link
                                    key={item.href}
                                    ref={isActive ? active : undefined}
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
                    </div>

                    <SectionsMenu />
                </nav>

                <div className="tw-header-tools">
                    <Search />
                    <ReaderMenu />
                </div>
            </div>

            {/* The front page only: elsewhere the reader came for something else */}
            {pathname === '/' && <LiveTicker />}
        </header>
    )
}

function SectionsMenu() {
    const [open, setOpen] = useState(false)
    const close = useCallback(() => setOpen(false), [])
    const { root, trigger, panelId } = usePopover(open, close)

    return (
        <div ref={root} style={{ position: 'relative' }}>
            <button
                ref={trigger}
                type="button"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpen(!open)}
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

            {open && (
                <div
                    id={panelId}
                    className="tw-sections-panel"
                    style={{ ...popoverPanel, marginTop: 8, minWidth: 180 }}
                >
                    {SECTIONS.map((section) => (
                        <Link
                            key={section.href}
                            href={section.href}
                            onClick={close}
                            className="tw-menu-item"
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
            )}
        </div>
    )
}
