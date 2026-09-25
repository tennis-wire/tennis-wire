// What stands in for a page that is missing or failed: under the header, in the site's look
export default function PageNotice({
    title,
    children,
}: {
    title: string
    children: React.ReactNode
}) {
    return (
        <div style={{ maxWidth: 560, padding: '40px 0 16px' }}>
            <h1 style={{ fontSize: 34, lineHeight: 1.15, margin: '0 0 12px' }}>{title}</h1>
            {children}
        </div>
    )
}

export const noticeText: React.CSSProperties = {
    fontSize: 17,
    lineHeight: 1.5,
    color: 'var(--tw-text-secondary)',
    margin: '0 0 22px',
}

export const noticeActions: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 20,
    fontSize: 15,
}

export const noticeLink: React.CSSProperties = {
    color: 'var(--tw-primary)',
    fontWeight: 600,
}
