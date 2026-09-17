import { describe, expect, it } from 'vitest'

import { DiscussionError } from './api'
import { MAX_LENGTH, classify, normalize, problem } from './compose'

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

describe('classify', () => {
    it('tells a reader replying to a comment that went altogether that it is gone', () => {
        const gone = new DiscussionError(404, 'NOT_FOUND', 'Comment not found: 1')
        const down = new DiscussionError(409, 'PARENT_DELETED', 'Comment is no longer standing: 1')

        expect(classify(gone, true)).toEqual({ kind: 'parent' })
        expect(classify(down, true)).toEqual({ kind: 'parent' })
    })

    it('does not read a 404 on a top-level comment as a parent gone', () => {
        const gone = new DiscussionError(404, 'NOT_FOUND', 'no route')

        expect(classify(gone, false)).toEqual({ kind: 'other', message: 'no route' })
    })
})
