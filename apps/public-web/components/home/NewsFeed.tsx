import Link from 'next/link'

import SectionHead from './SectionHead'

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
        time: '25 минут назад',
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

const slash = <span style={{ color: 'var(--tw-border)' }}>/</span>

// Headlines without covers: a news item is read by its title
export default function NewsFeed() {
    return (
        <section>
            <SectionHead title="Новости" href="/news" more="Все новости" gap={6} />
            <div style={{ borderBottom: '1px solid var(--tw-border)' }}>
                {MOCK_NEWS.map((item) => (
                    <Link
                        key={item.slug}
                        href={`/news/${item.slug}`}
                        style={{
                            display: 'block',
                            padding: '16px 0',
                            borderTop: '1px solid var(--tw-border)',
                            color: 'var(--tw-text)',
                        }}
                    >
                        <div
                            style={{
                                fontSize: 19,
                                fontWeight: 600,
                                lineHeight: 1.3,
                                marginBottom: 6,
                                maxWidth: '64ch',
                            }}
                        >
                            {item.title}
                        </div>
                        <div
                            style={{
                                display: 'flex',
                                gap: 10,
                                fontSize: 13,
                                color: 'var(--tw-text-secondary)',
                            }}
                        >
                            <span>{item.time}</span>
                            {slash}
                            <span>{item.tag}</span>
                        </div>
                    </Link>
                ))}
            </div>
        </section>
    )
}
