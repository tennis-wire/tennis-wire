import Link from 'next/link'

interface NewsItem {
    slug: string
    title: string
    time: string
    tag: string
}

const MOCK_NEWS: NewsItem[] = [
    {
        slug: 'rybakina-doha',
        title: 'Рыбакина снялась с турнира в Дохе из-за травмы',
        time: '25 мин назад',
        tag: 'WTA 1000',
    },
    {
        slug: 'medvedev-semifinal',
        title: 'Медведев прокомментировал поражение в полуфинале',
        time: '1 час назад',
        tag: 'ATP Masters',
    },
    {
        slug: 'kasatkina-abu-dhabi',
        title: 'Касаткина вышла в финал турнира в Абу-Даби',
        time: '2 часа назад',
        tag: 'WTA 500',
    },
    {
        slug: 'djokovic-injury-update',
        title: 'Джокович: «Колено восстанавливается, планирую играть на Roland Garros»',
        time: '3 часа назад',
        tag: 'ATP',
    },
]

export default function NewsFeed() {
    return (
        <div
            style={{
                background: 'var(--tw-surface)',
                border: '1px solid var(--tw-border)',
                borderRadius: 12,
                padding: 20,
                boxShadow: 'var(--tw-card-shadow)',
                marginBottom: 24,
            }}
        >
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
                    Новости
                </h2>
                <Link
                    href="/news"
                    style={{
                        fontSize: 12,
                        color: 'var(--tw-text-muted)',
                        textDecoration: 'none',
                    }}
                >
                    Все новости →
                </Link>
            </div>

            {MOCK_NEWS.map((item, i) => (
                <Link
                    key={item.slug}
                    href={`/news/${item.slug}`}
                    style={{
                        display: 'flex',
                        gap: 12,
                        padding: '12px 0',
                        borderTop: i > 0 ? '1px solid var(--tw-border)' : 'none',
                        textDecoration: 'none',
                        color: 'var(--tw-text)',
                    }}
                >
                    {/* Image placeholder */}
                    <div
                        style={{
                            width: 72,
                            height: 52,
                            borderRadius: 8,
                            background: `linear-gradient(135deg, var(--tw-primary-light), var(--tw-accent))`,
                            opacity: 0.3,
                            flexShrink: 0,
                        }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                            style={{
                                fontSize: 14,
                                fontWeight: 500,
                                lineHeight: 1.35,
                                marginBottom: 4,
                            }}
                        >
                            {item.title}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--tw-text-muted)' }}>
                            {item.time} · {item.tag}
                        </div>
                    </div>
                </Link>
            ))}
        </div>
    )
}
