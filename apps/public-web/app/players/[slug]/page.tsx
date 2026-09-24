export default function PlayerPage({ params: _params }: { params: Promise<{ slug: string }> }) {
    return (
        <div>
            <h1 style={{ fontSize: 28 }}>Профиль игрока</h1>
            <p style={{ color: 'var(--tw-text-muted)', fontSize: 14 }}>
                Статистика, новости, материалы
            </p>
        </div>
    )
}
