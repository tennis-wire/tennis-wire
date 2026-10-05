import type { Metadata } from 'next'
import sanitizeHtml from 'sanitize-html'

import { appOrigin } from '@/lib/auth/config'
import { SITE_NAME } from '@/lib/site'

import { articleHref, fetchArticle, type Article, type ArticleType } from './articles'

const DESCRIPTION_LENGTH = 160

// What a search result or a shared link shows under the title when the article has no lead:
// the start of its text. Pictures, embeds, polls and quotes are left out, and the cut falls
// between words.
export function excerptOf(html: string, length = DESCRIPTION_LENGTH): string {
    const text = sanitizeHtml(html.replace(/<\/(p|h[1-6]|li)>|<br\s*\/?>/gi, ' '), {
        allowedTags: [],
        allowedAttributes: {},
        nonTextTags: ['figure', 'div', 'blockquote', 'iframe', 'video', 'style', 'script'],
    })
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')
        .trim()
    if (text.length <= length) return text
    const cut = text.slice(0, length - 1)
    const word = cut.lastIndexOf(' ')
    return `${(word > length / 2 ? cut.slice(0, word) : cut).replace(/[\s,;:.—-]+$/, '')}…`
}

export function descriptionOf(article: Article): string {
    return article.subtitle?.trim() || excerptOf(article.content)
}

export function articleUrl(article: Pick<Article, 'type' | 'slug'>): string {
    return `${appOrigin()}${articleHref(article)}`
}

// Title, canonical address and what a shared link shows. The site's name and language are
// repeated here: a page's openGraph replaces the layout's whole, it is not merged into it.
export function articleMetadata(article: Article): Metadata {
    const url = articleUrl(article)
    const description = descriptionOf(article)
    return {
        title: `${article.title} — ${SITE_NAME}`,
        description,
        alternates: { canonical: url },
        openGraph: {
            type: 'article',
            url,
            siteName: SITE_NAME,
            locale: 'ru_RU',
            title: article.title,
            description,
            images: article.coverImageUrl
                ? [{ url: article.coverImageUrl, alt: article.coverAlt ?? undefined }]
                : undefined,
            publishedTime: article.publishedAt,
            modifiedTime: article.revisedAt ?? undefined,
        },
        twitter: { card: 'summary_large_image' },
    }
}

// For both article routes. An article of the other type answers 404 on the page below, and
// the tab of that 404 should not carry the article's title either.
export async function metadataForArticle(slug: string, type: ArticleType): Promise<Metadata> {
    const article = await fetchArticle(slug)
    if (!article || article.type !== type) return {}
    return articleMetadata(article)
}

// What search engines read the article as. The publication stands as the author until the
// articles carry bylines of their own.
export function articleJsonLd(article: Article): Record<string, unknown> {
    const origin = appOrigin()
    const site = { '@type': 'Organization', name: SITE_NAME, url: origin }
    const section = article.tags.find((tag) => tag.type === 'section')
    return {
        '@context': 'https://schema.org',
        '@type': 'NewsArticle',
        mainEntityOfPage: articleUrl(article),
        url: articleUrl(article),
        headline: article.title,
        description: descriptionOf(article),
        image: article.coverImageUrl ? [article.coverImageUrl] : undefined,
        datePublished: article.publishedAt,
        dateModified: article.revisedAt ?? article.publishedAt,
        inLanguage: 'ru',
        articleSection: section?.name,
        keywords: article.tags.filter((tag) => tag.type !== 'section').map((tag) => tag.name),
        author: [site],
        publisher: { ...site, logo: { '@type': 'ImageObject', url: `${origin}/icon.svg` } },
    }
}

// Inside <script> nothing may close the element early: every < becomes its escape, which JSON
// reads back as the same character
export function jsonLdScript(data: Record<string, unknown>): string {
    return JSON.stringify(data).replace(/</g, '\\u003c')
}
