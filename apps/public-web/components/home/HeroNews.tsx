import Link from 'next/link'

export default function HeroNews() {
    return (
        <Link
            href="/news/sinner-australian-open"
            style={{
                display: 'block',
                background: 'var(--tw-surface)',
                border: '1px solid var(--tw-border)',
                borderRadius: 12,
                overflow: 'hidden',
                boxShadow: 'var(--tw-card-shadow)',
                textDecoration: 'none',
                color: 'var(--tw-text)',
            }}
        >
            {/* Image placeholder */}
            <div
                style={{
                    height: 220,
                    background: `linear-gradient(135deg, var(--tw-primary), var(--tw-primary-light))`,
                    display: 'flex',
                    alignItems: 'flex-end',
                    padding: 20,
                    position: 'relative',
                }}
            >
                <span
                    style={{
                        position: 'absolute',
                        top: 14,
                        left: 14,
                        background: 'var(--tw-live)',
                        color: '#fff',
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '4px 10px',
                        borderRadius: 4,
                        textTransform: 'uppercase',
                        letterSpacing: 1,
                    }}
                >
                    Срочно
                </span>
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'linear-gradient(to top, rgba(0,0,0,0.6), transparent)',
                    }}
                />
                <h2
                    style={{
                        position: 'relative',
                        color: '#fff',
                        fontFamily: 'var(--tw-font-display)',
                        fontSize: 22,
                        fontWeight: 700,
                        lineHeight: 1.3,
                        margin: 0,
                    }}
                >
                    Синнер обыграл Джоковича в финале Australian Open
                </h2>
            </div>

            <div style={{ padding: '14px 20px 18px' }}>
                <p
                    style={{
                        fontSize: 14,
                        color: 'var(--tw-text-secondary)',
                        lineHeight: 1.55,
                        margin: '0 0 12px',
                    }}
                >
                    Янник Синнер одержал убедительную победу в финале первого турнира Большого Шлема
                    сезона, подтвердив статус первой ракетки мира.
                </p>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span
                        style={{
                            background: 'var(--tw-tag)',
                            color: 'var(--tw-primary)',
                            fontSize: 11,
                            fontWeight: 600,
                            padding: '3px 8px',
                            borderRadius: 4,
                        }}
                    >
                        ATP
                    </span>
                    <span
                        style={{
                            background: 'var(--tw-tag)',
                            color: 'var(--tw-primary)',
                            fontSize: 11,
                            fontWeight: 600,
                            padding: '3px 8px',
                            borderRadius: 4,
                        }}
                    >
                        Grand Slam
                    </span>
                    <span
                        style={{
                            fontSize: 11,
                            color: 'var(--tw-text-muted)',
                            marginLeft: 'auto',
                        }}
                    >
                        15 мин назад
                    </span>
                </div>
            </div>
        </Link>
    )
}
