import { describe, expect, it } from 'vitest'
import { isValidNickname } from './nickname'

describe('isValidNickname', () => {
    it('accepts latin letters, digits, hyphen and underscore', () => {
        expect(isValidNickname('tennis_fan-01')).toBe(true)
    })

    it('rejects anything under 3 characters', () => {
        expect(isValidNickname('ab')).toBe(false)
    })

    it('rejects anything over 24 characters', () => {
        expect(isValidNickname('a'.repeat(25))).toBe(false)
    })

    it('rejects non-latin scripts', () => {
        expect(isValidNickname('теннис_фанат')).toBe(false)
    })

    it('rejects spaces', () => {
        expect(isValidNickname('tennis fan')).toBe(false)
    })
})
