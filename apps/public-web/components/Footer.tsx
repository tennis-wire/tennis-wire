import Link from 'next/link'

export default function Footer() {
    return (
        <footer
            style={{
                borderTop: '1px solid var(--tw-border)',
                background: 'var(--tw-surface)',
                marginTop: 60,
            }}
        >
            <div
                style={{
                    maxWidth: 1200,
                    margin: '0 auto',
                    padding: '24px 20px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 12,
                }}
            >
                <div
                    style={{
                        fontSize: 13,
                        color: 'var(--tw-text-muted)',
                    }}
                >
                    © 2026 Tennis Wire
                </div>
                <nav style={{ display: 'flex', gap: 20 }}>
                    {[
                        { label: 'О проекте', href: '/about' },
                        { label: 'Контакты', href: '/contacts' },
                    ].map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            style={{
                                fontSize: 13,
                                color: 'var(--tw-text-muted)',
                                textDecoration: 'none',
                            }}
                        >
                            {item.label}
                        </Link>
                    ))}
                </nav>
            </div>
        </footer>
    )
}
