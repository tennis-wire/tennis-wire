import Link from 'next/link'

import SectionHead from './SectionHead'

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
        <section>
            <SectionHead title="Материалы" href="/materials" more="Все материалы" gap={16} />
            <div className="tw-trio">
                {MOCK_MATERIALS.map((item) => (
                    <Link
                        key={item.slug}
                        href={`/materials/${item.slug}`}
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 10,
                            color: 'var(--tw-text)',
                        }}
                    >
                        <div
                            style={{
                                height: 140,
                                borderRadius: 10,
                                background:
                                    'linear-gradient(135deg, var(--tw-primary-light), var(--tw-accent))',
                                opacity: 0.28,
                            }}
                        />
                        <div
                            className="tw-display"
                            style={{
                                fontSize: 19,
                                lineHeight: 1.25,
                            }}
                        >
                            {item.title}
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--tw-text-secondary)' }}>
                            {item.readTime} чтения
                        </div>
                    </Link>
                ))}
            </div>
        </section>
    )
}
