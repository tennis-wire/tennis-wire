import { notFound } from 'next/navigation'

import Comments from '@/components/discussion/Comments'
import { fetchArticle, type ArticleType } from '@/lib/content/articles'
import { sanitizeArticle } from '@/lib/content/sanitize'

import ArticleHead from './ArticleHead'
import ArticleTags from './ArticleTags'

export default async function ArticlePage({ slug, type }: { slug: string; type: ArticleType }) {
    const article = await fetchArticle(slug)
    // A news slug under /materials, or the other way round, is not this page
    if (!article || article.type !== type) notFound()

    return (
        <article style={{ maxWidth: 760, margin: '0 auto' }}>
            <ArticleHead article={article} />
            <div
                className="tw-article-body"
                dangerouslySetInnerHTML={{ __html: sanitizeArticle(article.content) }}
            />
            <ArticleTags tags={article.tags} />
            <Comments subjectType="publication" subjectId={article.id} />
        </article>
    )
}
