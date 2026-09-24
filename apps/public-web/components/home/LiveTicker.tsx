import { Fragment } from 'react'
import Link from 'next/link'

interface LiveMatch {
    id: string
    player1: string
    player2: string
    score: string
}

const MOCK_MATCHES: LiveMatch[] = [
    { id: '1', player1: 'Синнер', player2: 'Алькарас', score: '6-4 3-2' },
    { id: '2', player1: 'Рублёв', player2: 'Медведев', score: '2-6 5-4' },
    { id: '3', player1: 'Рыбакина', player2: 'Свёнтек', score: '7-5 4-1' },
]

const bar: React.CSSProperties = {
    maxWidth: 1200,
    margin: '0 auto',
    padding: '0 20px',
    height: 38,
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    fontSize: 13,
    color: 'var(--tw-text-secondary)',
    whiteSpace: 'nowrap',
    overflowX: 'auto',
}

// The second line of the header on the front page: what is on court now
export default function LiveTicker() {
    if (MOCK_MATCHES.length === 0) return null

    return (
        <div style={{ borderTop: '1px solid var(--tw-border)' }}>
            <div style={bar}>
                <span
                    style={{
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: '0.1em',
                        color: 'var(--tw-live)',
                    }}
                >
                    LIVE
                </span>

                {MOCK_MATCHES.map((match, i) => (
                    <Fragment key={match.id}>
                        {i > 0 && (
                            <span aria-hidden style={{ color: 'var(--tw-border)' }}>
                                /
                            </span>
                        )}
                        <Link
                            href={`/live/${match.id}`}
                            style={{ color: 'var(--tw-text-secondary)', textDecoration: 'none' }}
                        >
                            <strong style={{ color: 'var(--tw-text)' }}>{match.player1}</strong>{' '}
                            {match.score} {match.player2}
                        </Link>
                    </Fragment>
                ))}

                <span style={{ flex: 1 }} />

                <Link
                    href="/live"
                    style={{ color: 'var(--tw-primary)', fontWeight: 600, textDecoration: 'none' }}
                >
                    Все матчи
                </Link>
            </div>
        </div>
    )
}
