import Link from 'next/link'

export function TournamentWidget() {
    return (
        <div
            style={{
                background: 'var(--tw-surface)',
                border: '1px solid var(--tw-border)',
                borderRadius: 12,
                padding: 16,
                boxShadow: 'var(--tw-card-shadow)',
            }}
        >
            <div
                style={{
                    fontSize: 11,
                    color: 'var(--tw-text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    marginBottom: 8,
                }}
            >
                Ближайший турнир
            </div>
            <div
                style={{
                    fontFamily: 'var(--tw-font-display)',
                    fontSize: 16,
                    marginBottom: 4,
                }}
            >
                Roland Garros 2026
            </div>
            <div style={{ fontSize: 13, color: 'var(--tw-text-muted)', marginBottom: 12 }}>
                25 мая — 8 июня
            </div>
            <div
                style={{
                    borderTop: '1px solid var(--tw-border)',
                    paddingTop: 10,
                }}
            >
                <Link
                    href="/tournaments/roland-garros-2026"
                    style={{
                        fontSize: 12,
                        color: 'var(--tw-primary)',
                        textDecoration: 'none',
                    }}
                >
                    Сетка · Расписание →
                </Link>
            </div>
        </div>
    )
}

export function RankingWidget() {
    const top = [
        { rank: 1, name: 'Синнер', points: '11,830' },
        { rank: 2, name: 'Алькарас', points: '9,855' },
        { rank: 3, name: 'Джокович', points: '8,120' },
        { rank: 4, name: 'Медведев', points: '6,740' },
        { rank: 5, name: 'Рублёв', points: '5,390' },
    ]

    return (
        <div
            style={{
                background: 'var(--tw-surface)',
                border: '1px solid var(--tw-border)',
                borderRadius: 12,
                padding: 16,
                boxShadow: 'var(--tw-card-shadow)',
            }}
        >
            <div
                style={{
                    fontSize: 11,
                    color: 'var(--tw-text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    marginBottom: 10,
                }}
            >
                Рейтинг ATP
            </div>
            {top.map((p) => (
                <div
                    key={p.rank}
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '4px 0',
                        fontSize: 13,
                    }}
                >
                    <span style={{ color: 'var(--tw-text-secondary)' }}>
                        {p.rank}. {p.name}
                    </span>
                    <span style={{ color: 'var(--tw-text-muted)' }}>{p.points}</span>
                </div>
            ))}
            <div
                style={{
                    borderTop: '1px solid var(--tw-border)',
                    paddingTop: 10,
                    marginTop: 8,
                }}
            >
                <Link
                    href="/rankings"
                    style={{
                        fontSize: 12,
                        color: 'var(--tw-primary)',
                        textDecoration: 'none',
                    }}
                >
                    Полный рейтинг →
                </Link>
            </div>
        </div>
    )
}
