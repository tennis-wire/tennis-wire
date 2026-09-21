import type { Metadata } from 'next'

import TagFeed, { type FeedQuery } from '@/components/content/TagFeed'
import { fetchTagPage } from '@/lib/content/tags'

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<FeedQuery> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params
    const result = await fetchTagPage(slug, null, 0)
    return { title: result ? `${result.tag.name} — Tennis Wire` : 'Tennis Wire' }
}

export default async function Page({ params, searchParams }: Props) {
    const [{ slug }, query] = await Promise.all([params, searchParams])
    return (
        <TagFeed
            slug={slug}
            base={`/tags/${encodeURIComponent(slug)}`}
            section={false}
            query={query}
        />
    )
}
