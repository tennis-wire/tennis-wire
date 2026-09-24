import Link from 'next/link'

// A block of the front page: its name, and the way to the whole of it
export default function SectionHead({
    title,
    href,
    more,
    gap,
}: {
    title: string
    href: string
    more: string
    gap: number
}) {
    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                marginBottom: gap,
            }}
        >
            <h2 style={{ fontSize: 24, margin: 0 }}>{title}</h2>
            <Link href={href} style={{ fontSize: 14, fontWeight: 600, color: 'var(--tw-primary)' }}>
                {more}
            </Link>
        </div>
    )
}
