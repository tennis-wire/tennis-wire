import Link from 'next/link'

interface MaterialItem {
    slug: string
    title: string
    readTime: string
}

const MOCK_MATERIALS: MaterialItem[] = [
    {
        slug: 'roland-garros-preview',
        title: 'Превью Roland Garros: кто фаворит на грунте?',
        readTime: '7 мин',
    },
    {
        slug: 'sinner-serve-2026',
        title: 'Разбор: как Синнер изменил свою подачу в 2026',
        readTime: '12 мин',
    },
    {
        slug: 'andreeva-interview',
        title: 'Интервью: Андреева о переходе во взрослый тур',
        readTime: '5 мин',
    },
]

export default function MaterialsGrid() {
    return (
        <div style={{ marginBottom: 24 }}>
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 14,
                }}
            >
                <h2
                    style={{
                        fontFamily: 'var(--tw-font-display)',
                        fontSize: 20,
                        margin: 0,
                    }}
                >
                    Материалы
                </h2>
                <Link
                    href="/materials"
                    style={{
                        fontSize: 12,
                        color: 'var(--tw-text-muted)',
                        textDecoration: 'none',
                    }}
                >
                    Все материалы →
                </Link>
            </div>

            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 16,
                }}
            >
                {MOCK_MATERIALS.map((item) => (
                    <Link
                        key={item.slug}
                        href={`/materials/${item.slug}`}
                        style={{
                            background: 'var(--tw-surface)',
                            border: '1px solid var(--tw-border)',
                            borderRadius: 12,
                            overflow: 'hidden',
                            boxShadow: 'var(--tw-card-shadow)',
                            textDecoration: 'none',
                            color: 'var(--tw-text)',
                        }}
                    >
                        {/* Cover placeholder */}
                        <div
                            style={{
                                height: 120,
                                background: `linear-gradient(135deg, var(--tw-primary-light), var(--tw-accent))`,
                                opacity: 0.25,
                            }}
                        />
                        <div style={{ padding: '12px 14px' }}>
                            <div
                                style={{
                                    fontSize: 14,
                                    fontWeight: 500,
                                    lineHeight: 1.35,
                                    marginBottom: 6,
                                    fontFamily: 'var(--tw-font-display)',
                                }}
                            >
                                {item.title}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--tw-text-muted)' }}>
                                {item.readTime} чтения
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    )
}
