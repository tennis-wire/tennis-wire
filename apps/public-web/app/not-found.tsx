import type { Metadata } from 'next'
import Link from 'next/link'

import PageNotice, { noticeActions, noticeLink, noticeText } from '@/components/PageNotice'

export const metadata: Metadata = { title: 'Страница не найдена — Tennis Wire' }

// Both an address nothing answers to and a notFound() from an article, a tag or a reader
export default function NotFound() {
    return (
        <PageNotice title="Страница не найдена">
            <p style={noticeText}>Возможно, материал сняли или адрес набран с ошибкой.</p>
            <div style={noticeActions}>
                <Link href="/" style={noticeLink}>
                    На главную
                </Link>
                <Link href="/news" style={noticeLink}>
                    Новости
                </Link>
            </div>
        </PageNotice>
    )
}
