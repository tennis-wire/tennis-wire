import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import ReaderPage from '@/components/readers/ReaderPage'

type Props = { params: Promise<{ id: string }> }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Drawn in the browser, so there is nothing here for a search engine anyway
export const metadata: Metadata = { title: 'Читатель — Tennis Wire', robots: { index: false } }

export default async function ReaderRoute({ params }: Props) {
    const { id } = await params
    if (!UUID.test(id)) notFound()
    return (
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
            <ReaderPage id={id.toLowerCase()} />
        </div>
    )
}
