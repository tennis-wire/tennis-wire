import Link from 'next/link'

const HREF = '/news/sinner-australian-open'

const tag: React.CSSProperties = {
    background: 'var(--tw-tag)',
    color: 'var(--tw-primary)',
    fontWeight: 700,
    padding: '4px 9px',
    borderRadius: 4,
}

// The lead story as type first: the headline carries it, the picture stands beside
export default function HeroNews() {
    return (
        <article
            className="tw-hero"
            style={{ paddingBottom: 30, borderBottom: '2px solid var(--tw-text)' }}
        >
            <div>
                <div style={{ fontSize: 13, color: 'var(--tw-text-secondary)', marginBottom: 14 }}>
                    15 мин назад
                </div>
                <h2
                    style={{
                        fontSize: 'clamp(30px, 8vw, 44px)',
                        lineHeight: 1.08,
                        letterSpacing: '-0.015em',
                        margin: '0 0 16px',
                    }}
                >
                    <Link href={HREF} style={{ color: 'var(--tw-text)' }}>
                        Синнер обыграл Джоковича в финале Australian Open
                    </Link>
                </h2>
                <p
                    style={{
                        fontSize: 18,
                        lineHeight: 1.5,
                        color: 'var(--tw-text-secondary)',
                        margin: '0 0 18px',
                        maxWidth: '52ch',
                    }}
                >
                    Янник Синнер одержал убедительную победу в финале первого турнира Большого Шлема
                    сезона, подтвердив статус первой ракетки мира.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, fontSize: 13 }}>
                    <span style={tag}>ATP</span>
                    <span style={tag}>Grand Slam</span>
                </div>
            </div>

            {/* The headline is the link for a keyboard and a screen reader; this is for the mouse */}
            <Link href={HREF} tabIndex={-1} aria-hidden>
                <div
                    style={{
                        height: 250,
                        borderRadius: 10,
                        background: 'linear-gradient(135deg, var(--tw-primary), var(--tw-accent))',
                    }}
                />
            </Link>
        </article>
    )
}
