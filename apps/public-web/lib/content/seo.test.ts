import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Article } from './articles'
import { articleJsonLd, articleMetadata, excerptOf, jsonLdScript, metadataForArticle } from './seo'

function article(overrides: Partial<Article> = {}): Article {
    return {
        id: 'a1',
        type: 'news',
        slug: 'sinner-wins',
        title: 'Sinner wins',
        subtitle: null,
        content: '<p>Jannik Sinner won the final.</p>',
        coverImageUrl: 'https://media.example.com/2026/10/c.jpg',
        coverAlt: 'Sinner with the trophy',
        coverCaption: null,
        coverCredit: null,
        coverCreditKind: null,
        readingTime: null,
        sourceUrl: null,
        sourceName: null,
        tags: [
            { id: 't1', name: 'Новости', slug: 'news', type: 'section' },
            { id: 't2', name: 'Янник Синнер', slug: 'jannik-sinner', type: 'player' },
        ],
        publishedAt: '2026-10-01T10:00:00Z',
        revisedAt: null,
        ...overrides,
    }
}

beforeEach(() => {
    vi.stubEnv('APP_ORIGIN', 'https://tennis.example/')
})

afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
})

describe('excerptOf', () => {
    it('takes the text and leaves out pictures, embeds, polls and quotes', () => {
        const html =
            '<h2>Final</h2><p>Sinner &amp; Alcaraz met <strong>again</strong>.</p>' +
            '<figure><img src="x"><figcaption><span data-caption>Court</span></figcaption></figure>' +
            '<div data-poll="p"><p class="poll-question">Who?</p></div>' +
            '<blockquote><p>A quote</p></blockquote><p>Then rain.</p>'

        expect(excerptOf(html)).toBe('Final Sinner & Alcaraz met again. Then rain.')
    })

    it('cuts between words and says so', () => {
        const text = 'слово '.repeat(60)

        const excerpt = excerptOf(`<p>${text}</p>`)

        expect(excerpt.length).toBeLessThanOrEqual(160)
        expect(excerpt).toMatch(/слово…$/)
    })
})

describe('articleMetadata', () => {
    it('names the canonical address and what a shared link shows', () => {
        const meta = articleMetadata(article({ revisedAt: '2026-10-02T09:00:00Z' }))

        expect(meta.title).toBe('Sinner wins — Tennis Wire')
        expect(meta.alternates?.canonical).toBe('https://tennis.example/news/sinner-wins')
        expect(meta.openGraph).toMatchObject({
            type: 'article',
            url: 'https://tennis.example/news/sinner-wins',
            siteName: 'Tennis Wire',
            locale: 'ru_RU',
            publishedTime: '2026-10-01T10:00:00Z',
            modifiedTime: '2026-10-02T09:00:00Z',
            images: [
                { url: 'https://media.example.com/2026/10/c.jpg', alt: 'Sinner with the trophy' },
            ],
        })
    })

    it('describes a news item without a lead by the start of its text', () => {
        expect(articleMetadata(article()).description).toBe('Jannik Sinner won the final.')
        expect(articleMetadata(article({ subtitle: 'The lead' })).description).toBe('The lead')
    })

    it('gives the 404 of the wrong route no title of the article', async () => {
        vi.stubEnv('GATEWAY_ORIGIN', 'http://gateway.test')
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => Response.json(article()))
        )

        expect(await metadataForArticle('sinner-wins', 'article')).toEqual({})
        expect((await metadataForArticle('sinner-wins', 'news')).title).toBe(
            'Sinner wins — Tennis Wire'
        )
    })
})

describe('articleJsonLd', () => {
    it('reads the article as news by the publication', () => {
        const data = articleJsonLd(article())

        expect(data).toMatchObject({
            '@type': 'NewsArticle',
            headline: 'Sinner wins',
            datePublished: '2026-10-01T10:00:00Z',
            dateModified: '2026-10-01T10:00:00Z',
            articleSection: 'Новости',
            keywords: ['Янник Синнер'],
            author: [
                { '@type': 'Organization', name: 'Tennis Wire', url: 'https://tennis.example' },
            ],
        })
    })

    it('cannot close its script element early', () => {
        const script = jsonLdScript(articleJsonLd(article({ title: '</script><script>alert(1)' })))

        expect(script).not.toContain('</script>')
        expect(JSON.parse(script).headline).toBe('</script><script>alert(1)')
    })
})
