export default function MatchPage({ params: _params }: { params: Promise<{ id: string }> }) {
    return (
        <div>
            <h1 style={{ fontFamily: 'var(--tw-font-display)', fontSize: 28 }}>Детали матча</h1>
            <p style={{ color: 'var(--tw-text-muted)', fontSize: 14 }}>
                Счёт, статистика, ход матча
            </p>
        </div>
    )
}
