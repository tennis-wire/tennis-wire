import { notFound } from 'next/navigation'

import Comments from '@/components/discussion/Comments'
import { fetchArticle, type ArticleType } from '@/lib/content/articles'
import { splitPolls } from '@/lib/content/polls'
import { sanitizeArticle } from '@/lib/content/sanitize'
import { mediaOrigin } from '@/lib/security/csp'

import ArticleHead from './ArticleHead'
import EditArticleLink from './EditArticleLink'
import ArticleTags from './ArticleTags'
import PollWidget from './PollWidget'

export default async function ArticlePage({ slug, type }: { slug: string; type: ArticleType }) {
    const article = await fetchArticle(slug)
    // A news slug under /materials, or the other way round, is not this page
    if (!article || article.type !== type) notFound()

    return (
        <article style={{ maxWidth: 760, margin: '0 auto' }}>
            <EditArticleLink articleId={article.id} />
            <ArticleHead article={article} />
            <div className="tw-article-body">
                {splitPolls(sanitizeArticle(article.content, mediaOrigin())).map((piece, i) =>
                    'pollId' in piece ? (
                        <PollWidget
                            key={piece.pollId}
                            id={piece.pollId}
                            fallback={piece.fallback}
                        />
                    ) : (
                        <div key={i} dangerouslySetInnerHTML={{ __html: piece.html }} />
                    )
                )}
            </div>
            <ArticleTags tags={article.tags} />
            <Comments subjectType="publication" subjectId={article.id} />
        </article>
    )
}
