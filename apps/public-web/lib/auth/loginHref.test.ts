import { describe, expect, it } from 'vitest'

import { buildLoginHref } from './loginHref'

describe('buildLoginHref', () => {
    it('carries the page the reader was on', () => {
        expect(buildLoginHref('/news/sinner#c=42')).toBe(
            '/api/auth/login?returnTo=%2Fnews%2Fsinner%23c%3D42'
        )
    })

    it('falls back to the bare endpoint when there is no page', () => {
        expect(buildLoginHref(null)).toBe('/api/auth/login')
    })
})
