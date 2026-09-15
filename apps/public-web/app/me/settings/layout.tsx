'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { useReaderSession } from '@/components/auth/ReaderSessionProvider'

const SECTIONS = [
    { href: '/me/settings/appearance', label: 'Внешний вид', account: false },
    { href: '/me/settings/actions', label: 'Действия', account: true },
]

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
    const { session } = useReaderSession()
    const pathname = usePathname()
    const signedIn = session?.authenticated === true

    return (
        <div className="tw-settings">
            <nav className="tw-settings-nav">
                {SECTIONS.filter((section) => signedIn || !section.account).map((section) => {
                    const active = pathname === section.href

                    return (
                        <Link
                            key={section.href}
                            href={section.href}
                            aria-current={active ? 'page' : undefined}
                            style={{
                                display: 'block',
                                padding: '10px 14px',
                                borderRadius: 7,
                                fontSize: 14,
                                fontWeight: active ? 600 : 400,
                                color: active ? 'var(--tw-primary)' : 'var(--tw-text-secondary)',
                                background: active ? 'var(--tw-tag)' : 'transparent',
                                textDecoration: 'none',
                            }}
                        >
                            {section.label}
                        </Link>
                    )
                })}
            </nav>
            <div style={{ padding: '24px 28px 32px', minWidth: 0 }}>{children}</div>
        </div>
    )
}
