export default function MaterialPage({ params: _params }: { params: Promise<{ slug: string }> }) {
    return (
        <div>
            <h1 style={{ fontFamily: 'var(--tw-font-display)', fontSize: 28 }}>
                Страница материала
            </h1>
            <p style={{ color: 'var(--tw-text-muted)', fontSize: 14 }}>
                Динамическая страница /materials/[slug]
            </p>
        </div>
    )
}
