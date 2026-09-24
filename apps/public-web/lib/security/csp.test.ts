import { describe, expect, it } from 'vitest'

import { contentSecurityPolicy, originOf } from './csp'

function directives(policy: string): Map<string, string[]> {
    return new Map(
        policy.split('; ').map((directive) => {
            const [name, ...values] = directive.split(' ')
            return [name!, values]
        })
    )
}

const stand = {
    dev: false,
    media: 'https://media.example',
    keycloak: 'https://id.example',
}

describe('contentSecurityPolicy', () => {
    it('lets images and video in from the media host and nowhere else', () => {
        const policy = directives(contentSecurityPolicy(stand))

        expect(policy.get('img-src')).toEqual(["'self'", 'data:', 'blob:', 'https://media.example'])
        expect(policy.get('media-src')).toEqual(["'self'", 'https://media.example'])
    })

    it('sends forms to this site and to Keycloak only', () => {
        const policy = directives(contentSecurityPolicy(stand))

        expect(policy.get('form-action')).toEqual(["'self'", 'https://id.example'])
    })

    it('frames the embeds the sanitizer keeps, and is framed by nobody', () => {
        const policy = directives(contentSecurityPolicy(stand))

        expect(policy.get('frame-src')).toEqual([
            'https://www.youtube.com',
            'https://www.youtube-nocookie.com',
            'https://t.me',
        ])
        expect(policy.get('frame-ancestors')).toEqual(["'none'"])
        expect(policy.get('object-src')).toEqual(["'none'"])
    })

    it('allows eval in development only', () => {
        expect(directives(contentSecurityPolicy(stand)).get('script-src')).toEqual([
            "'self'",
            "'unsafe-inline'",
        ])
        expect(
            directives(contentSecurityPolicy({ ...stand, dev: true })).get('script-src')
        ).toContain("'unsafe-eval'")
    })

    it('leaves out a host that is not configured', () => {
        const policy = directives(contentSecurityPolicy({ ...stand, media: null, keycloak: null }))

        expect(policy.get('img-src')).toEqual(["'self'", 'data:', 'blob:'])
        expect(policy.get('media-src')).toEqual(["'self'"])
        expect(policy.get('form-action')).toEqual(["'self'"])
    })
})

describe('originOf', () => {
    it('keeps the origin of a bucket or realm URL', () => {
        expect(originOf('http://localhost:9000/media')).toBe('http://localhost:9000')
        expect(originOf('http://localhost:8180/realms/tennis-wire')).toBe('http://localhost:8180')
    })

    it('gives nothing for a value that is not an http(s) URL', () => {
        expect(originOf(undefined)).toBeNull()
        expect(originOf('')).toBeNull()
        expect(originOf('localhost:9000')).toBeNull()
        expect(originOf('media.example')).toBeNull()
    })
})
