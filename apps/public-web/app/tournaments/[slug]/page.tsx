export default function TournamentPage({ params: _params }: { params: Promise<{ id: string }> }) {
    return (
        <div>
            <h1 style={{ fontSize: 28 }}>Страница турнира</h1>
            <p style={{ color: 'var(--tw-text-muted)', fontSize: 14 }}>
                Информация, сетка, расписание
            </p>
        </div>
    )
}
