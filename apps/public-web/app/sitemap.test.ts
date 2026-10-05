import { afterEach, describe, expect, it, vi } from 'vitest'

import sitemap from './sitemap'

afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
})

describe('sitemap', () => {
    it('lists the front page and every article, dated by its last revision', async () => {
        vi.stubEnv('APP_ORIGIN', 'https://tennis.example')
        vi.stubEnv('GATEWAY_ORIGIN', 'http://gateway.test')
        const fetchMock = vi.fn(async () =>
            Response.json([
                {
                    type: 'article',
                    slug: 'long-read',
                    publishedAt: '2026-10-01T10:00:00Z',
                    revisedAt: '2026-10-03T08:00:00Z',
                },
                {
                    type: 'news',
                    slug: 'short',
                    publishedAt: '2026-09-30T10:00:00Z',
                    revisedAt: null,
                },
            ])
        )
        vi.stubGlobal('fetch', fetchMock)

        expect(await sitemap()).toEqual([
            { url: 'https://tennis.example/' },
            {
                url: 'https://tennis.example/materials/long-read',
                lastModified: '2026-10-03T08:00:00Z',
            },
            { url: 'https://tennis.example/news/short', lastModified: '2026-09-30T10:00:00Z' },
        ])
        expect(fetchMock).toHaveBeenCalledWith(
            'http://gateway.test/api/public/sitemap/articles',
            expect.anything()
        )
    })
})
