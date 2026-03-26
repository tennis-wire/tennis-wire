import Link from 'next/link'

interface LiveMatch {
    id: string
    player1: string
    player2: string
    score: string
}

const MOCK_MATCHES: LiveMatch[] = [
    { id: '1', player1: 'Синнер', player2: 'Алькарас', score: '6-4 3-' },
    { id: '2', player1: 'Рублёв', player2: 'Медведев', score: '2-6 5-' },
    { id: '3', player1: 'Рыбакина', player2: 'Свёнтек', score: '7-5 4-' },
]

export default function LiveTicker() {
    if (MOCK_MATCHES.length === 0) return null

    return (
        <div
            style={{
                background: 'var(--tw-surface)',
                border: '1px solid var(--tw-border)',
                borderRadius: 12,
                padding: '10px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                marginBottom: 24,
                overflowX: 'auto',
            }}
        >
            <span
                style={{
                    background: 'var(--tw-live)',
                    color: '#fff',
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: 4,
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                    flexShrink: 0,
                }}
            >
                Live
            </span>

            <div style={{ display: 'flex', gap: 10, flex: 1, overflowX: 'auto' }}>
                {MOCK_MATCHES.map((match) => (
                    <Link
                        key={match.id}
                        href={`/live/${match.id}`}
                        style={{
                            whiteSpace: 'nowrap',
                            fontSize: 13,
                            padding: '5px 12px',
                            background: 'var(--tw-bg)',
                            borderRadius: 8,
                            border: '1px solid var(--tw-border)',
                            textDecoration: 'none',
                            color: 'var(--tw-text)',
                            flexShrink: 0,
                        }}
                    >
                        <span style={{ fontWeight: 600 }}>{match.player1}</span>
                        <span style={{ color: 'var(--tw-text-muted)', margin: '0 6px' }}>
                            {match.score}
                        </span>
                        <span>{match.player2}</span>
                    </Link>
                ))}
            </div>

            <Link
                href="/live"
                style={{
                    fontSize: 12,
                    color: 'var(--tw-text-muted)',
                    textDecoration: 'none',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                }}
            >
                Все матчи →
            </Link>
        </div>
    )
}
