export default function PlayerPage({ params: _params }: { params: Promise<{ slug: string }> }) {
    return (
        <div>
            <h1 style={{ fontFamily: 'var(--tw-font-display)', fontSize: 28 }}>Профиль игрока</h1>
            <p style={{ color: 'var(--tw-text-muted)', fontSize: 14 }}>
                Статистика, новости, материалы
            </p>
        </div>
    )
}
