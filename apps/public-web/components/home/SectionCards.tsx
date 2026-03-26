import Link from 'next/link'

const SECTIONS = [
    {
        slug: 'trash',
        label: 'Треш-зона',
        description: 'Кринж, скандалы, мемы',
        icon: '!',
        accentBg: 'var(--tw-live-bg)',
        accentColor: 'var(--tw-live)',
    },
]

export default function SectionCards() {
    return (
        <div style={{ marginBottom: 24 }}>
            <h2
                style={{
                    fontFamily: 'var(--tw-font-display)',
                    fontSize: 20,
                    marginBottom: 14,
                }}
            >
                Разделы
            </h2>
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: 12,
                }}
            >
                {SECTIONS.map((section) => (
                    <Link
                        key={section.slug}
                        href={`/sections/${section.slug}`}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            background: 'var(--tw-surface)',
                            border: '1px solid var(--tw-border)',
                            borderRadius: 12,
                            padding: 16,
                            textDecoration: 'none',
                            color: 'var(--tw-text)',
                            boxShadow: 'var(--tw-card-shadow)',
                        }}
                    >
                        <div
                            style={{
                                width: 40,
                                height: 40,
                                borderRadius: 10,
                                background: section.accentBg,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 16,
                                fontWeight: 700,
                                color: section.accentColor,
                                flexShrink: 0,
                            }}
                        >
                            {section.icon}
                        </div>
                        <div>
                            <div style={{ fontSize: 14, fontWeight: 600 }}>{section.label}</div>
                            <div
                                style={{
                                    fontSize: 12,
                                    color: 'var(--tw-text-muted)',
                                }}
                            >
                                {section.description}
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    )
}
