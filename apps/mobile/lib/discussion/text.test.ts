import { describe, expect, it } from 'vitest'

import { countLinks, splitLinks } from './text'

describe('splitLinks', () => {
    it('leaves plain text alone', () => {
        expect(splitLinks('no links here')).toEqual([{ kind: 'text', text: 'no links here' }])
    })

    it('cuts links out of the text and keeps the sentence around them', () => {
        expect(splitLinks('see https://example.com/a and http://b.example/x?y=1.')).toEqual([
            { kind: 'text', text: 'see ' },
            { kind: 'link', href: 'https://example.com/a' },
            { kind: 'text', text: ' and ' },
            { kind: 'link', href: 'http://b.example/x?y=1' },
            { kind: 'text', text: '.' },
        ])
    })

    it('does not swallow closing punctuation', () => {
        expect(splitLinks('(https://example.com/a).')).toEqual([
            { kind: 'text', text: '(' },
            { kind: 'link', href: 'https://example.com/a' },
            { kind: 'text', text: ').' },
        ])
    })

    it('takes only http and https for a link', () => {
        expect(splitLinks('ftp://x.y and javascript:alert(1) and www.example.com')).toEqual([
            { kind: 'text', text: 'ftp://x.y and javascript:alert(1) and www.example.com' },
        ])
    })
})

describe('countLinks', () => {
    it('counts what would be drawn as a link', () => {
        expect(countLinks('https://a.b https://a.b https://c.d, done')).toBe(3)
        expect(countLinks('none')).toBe(0)
    })
})
