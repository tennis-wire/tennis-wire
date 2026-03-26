export default function TagPage({ params: _params }: { params: Promise<{ slug: string }> }) {
    return (
        <div>
            <h1 style={{ fontFamily: 'var(--tw-font-display)', fontSize: 28 }}>Тег</h1>
            <p style={{ color: 'var(--tw-text-muted)', fontSize: 14 }}>
                Новости и материалы по тегу
            </p>
        </div>
    )
}
