import { describe, expect, it } from 'vitest'

import { articleHref } from './articles'

describe('articleHref', () => {
    it('puts news under /news and everything longer under /materials', () => {
        expect(articleHref({ type: 'news', slug: 'sinner-wins' })).toBe('/news/sinner-wins')
        expect(articleHref({ type: 'article', slug: 'season-review' })).toBe(
            '/materials/season-review'
        )
    })
})
