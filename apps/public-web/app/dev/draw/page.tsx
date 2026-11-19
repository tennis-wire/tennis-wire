import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import DevDraws from '@/components/tennis/DevDraws'

export const metadata: Metadata = {
    title: 'Сетки на примерах — Tennis Wire',
    robots: { index: false, follow: false },
}

type Props = { searchParams: Promise<{ s?: string | string[] }> }

// The draw on made-up tournaments, while there is no data to draw it from. The results are
// invented, so a deployed site answers 404 here. ?s= opens one of them: ?s=finals
export default async function DevDrawPage({ searchParams }: Props) {
    if (process.env.NODE_ENV === 'production') notFound()
    const { s } = await searchParams
    return (
        <div>
            <h1 style={{ fontSize: 28, marginBottom: 8 }}>Сетки на примерах</h1>
            <p style={{ color: 'var(--tw-text-muted)', fontSize: 14, margin: '0 0 24px' }}>
                Турниры и результаты выдуманы
            </p>
            <DevDraws initial={typeof s === 'string' ? s : undefined} />
        </div>
    )
}
