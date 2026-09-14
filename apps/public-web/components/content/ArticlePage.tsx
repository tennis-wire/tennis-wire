import { notFound } from 'next/navigation'

import { fetchArticle, type ArticleType } from '@/lib/content/articles'
import { sanitizeArticle } from '@/lib/content/sanitize'

// The bare page: title and body. Cover, tags, date and the rest come with the step that draws
// the article; this one exists so that the comments have an id to hang off.
export default async function ArticlePage({ slug, type }: { slug: string; type: ArticleType }) {
    const article = await fetchArticle(slug)
    // A news slug under /materials, or the other way round, is not this page
    if (!article || article.type !== type) notFound()

    return (
        <article style={{ maxWidth: 760, margin: '0 auto' }}>
            <h1 style={{ fontFamily: 'var(--tw-font-display)', fontSize: 32, lineHeight: 1.2 }}>
                {article.title}
            </h1>
            <div
                className="tw-article-body"
                dangerouslySetInnerHTML={{ __html: sanitizeArticle(article.content) }}
            />
        </article>
    )
}
