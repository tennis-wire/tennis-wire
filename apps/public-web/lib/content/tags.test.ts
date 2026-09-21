import { describe, expect, it } from 'vitest'

import { tagHref } from './tags'

describe('tagHref', () => {
    it('sends a section to its rubric and any other tag to the tag page', () => {
        expect(tagHref({ slug: 'trash', type: 'section' })).toBe('/sections/trash')
        expect(tagHref({ slug: 'sinner', type: 'player' })).toBe('/tags/sinner')
        expect(tagHref({ slug: 'atp', type: 'organization' })).toBe('/tags/atp')
    })

    it('keeps a slug that is not URL-safe inside one path segment', () => {
        expect(tagHref({ slug: 'a/b c', type: 'topic' })).toBe('/tags/a%2Fb%20c')
    })
})
