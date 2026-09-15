import { describe, expect, it } from 'vitest'

import { MAX_LENGTH, normalize, problem } from './compose'

describe('normalize', () => {
    it('trims the edges and squeezes blank lines, keeping single line breaks', () => {
        expect(normalize('  first line  \r\n\r\n\r\n\r\nsecond\nthird \n\n')).toBe(
            'first line\n\nsecond\nthird'
        )
    })

    it('leaves inner spacing alone', () => {
        expect(normalize('a  b\n  indented')).toBe('a  b\n  indented')
    })
})

describe('problem', () => {
    it('is empty for whitespace alone', () => {
        expect(problem('  \n\n ')).toBe('empty')
    })

    it('counts length after normalizing', () => {
        expect(problem('x'.repeat(MAX_LENGTH) + '\n\n\n')).toBeNull()
        expect(problem('x'.repeat(MAX_LENGTH + 1))).toBe('long')
    })

    it('allows three links and not four', () => {
        const three = 'https://a.b https://a.b/c https://a.b/d'
        expect(problem(three)).toBeNull()
        expect(problem(`${three} https://a.b/e`)).toBe('links')
    })
})
