'use client'

import Link from 'next/link'

import PageNotice, { noticeActions, noticeLink, noticeText } from '@/components/PageNotice'

const button: React.CSSProperties = {
    font: 'inherit',
    fontSize: 14,
    padding: '9px 18px',
    borderRadius: 7,
    border: '1px solid var(--tw-primary)',
    background: 'var(--tw-primary)',
    color: 'var(--tw-on-primary)',
    cursor: 'pointer',
}

// The digest is what the server logged the error under: a reader who reports it gives us the line
export default function ErrorPage({
    error,
    retry,
}: {
    error: Error & { digest?: string }
    retry: () => void
}) {
    return (
        <PageNotice title="Не удалось загрузить страницу">
            {/* A client component cannot export metadata */}
            <title>Не удалось загрузить страницу — Tennis Wire</title>
            <p style={noticeText}>
                Похоже, что-то сломалось на нашей стороне. Попробуйте ещё раз через минуту.
            </p>
            <div style={noticeActions}>
                <button type="button" onClick={retry} style={button}>
                    Попробовать ещё раз
                </button>
                <Link href="/" style={noticeLink}>
                    На главную
                </Link>
            </div>
            {error.digest && (
                <p style={{ margin: '28px 0 0', fontSize: 12, color: 'var(--tw-text-muted)' }}>
                    Код ошибки: {error.digest}
                </p>
            )}
        </PageNotice>
    )
}
