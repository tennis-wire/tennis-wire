import Link from 'next/link'

// A heading ruled off like a newspaper column's
const rubric: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: 'var(--tw-text-secondary)',
    paddingBottom: 10,
    borderBottom: '2px solid var(--tw-text)',
}

const more: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--tw-primary)',
    textDecoration: 'none',
}

export function TournamentWidget() {
    return (
        <section>
            <div style={rubric}>Ближайший турнир</div>
            <div
                style={{ fontFamily: 'var(--tw-font-display)', fontSize: 22, margin: '14px 0 4px' }}
            >
                Roland Garros 2026
            </div>
            <div style={{ fontSize: 14, color: 'var(--tw-text-secondary)', marginBottom: 12 }}>
                25 мая &mdash; 8 июня / Париж, грунт
            </div>
            <Link href="/tournaments/roland-garros-2026" style={more}>
                Сетка и расписание
            </Link>
        </section>
    )
}

const TOP = [
    { rank: 1, name: 'Синнер', points: 11830 },
    { rank: 2, name: 'Алькарас', points: 9855 },
    { rank: 3, name: 'Джокович', points: 8120 },
    { rank: 4, name: 'Медведев', points: 6740 },
    { rank: 5, name: 'Рублёв', points: 5390 },
]

const points = new Intl.NumberFormat('ru-RU')

export function RankingWidget() {
    return (
        <section>
            <div style={rubric}>Рейтинг ATP</div>
            <div style={{ marginTop: 6 }}>
                {TOP.map((player, i) => (
                    <div
                        key={player.rank}
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: '9px 0',
                            borderBottom:
                                i < TOP.length - 1 ? '1px solid var(--tw-border)' : 'none',
                            fontSize: 15,
                        }}
                    >
                        <span>
                            <span
                                style={{
                                    display: 'inline-block',
                                    width: 20,
                                    color: 'var(--tw-text-secondary)',
                                }}
                            >
                                {player.rank}
                            </span>
                            {player.name}
                        </span>
                        <span style={{ color: 'var(--tw-text-secondary)' }}>
                            {points.format(player.points)}
                        </span>
                    </div>
                ))}
            </div>
            <Link href="/rankings" style={{ ...more, display: 'inline-block', marginTop: 12 }}>
                Полный рейтинг
            </Link>
        </section>
    )
}

export function TrashZone() {
    return (
        <Link
            href="/sections/trash"
            style={{
                display: 'block',
                padding: 16,
                borderRadius: 10,
                background: 'var(--tw-live-bg)',
                textDecoration: 'none',
            }}
        >
            <div
                style={{ fontSize: 15, fontWeight: 700, color: 'var(--tw-live)', marginBottom: 4 }}
            >
                Треш-зона
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.4, color: 'var(--tw-text-secondary)' }}>
                Кринж, скандалы, мемы. Отдельный раздел со своими правилами.
            </div>
        </Link>
    )
}
