export default function SectionPage({ params: _params }: { params: Promise<{ slug: string }> }) {
    return (
        <div>
            <h1 style={{ fontFamily: 'var(--tw-font-display)', fontSize: 28 }}>
                Тематический раздел
            </h1>
            <p style={{ color: 'var(--tw-text-muted)', fontSize: 14 }}>
                Фильтр: всё / новости / материалы
            </p>
        </div>
    )
}
