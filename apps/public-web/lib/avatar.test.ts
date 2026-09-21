import { describe, expect, it } from 'vitest'

import { outputSide, refuseCrop, refuseSource, uploadError } from './avatar'

const square = (side: number) => ({ x: 0, y: 0, width: side, height: side })

describe('refuseSource', () => {
    it('takes the three formats the server takes', () => {
        for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
            expect(refuseSource({ type, size: 1000 })).toBeNull()
        }
    })

    it('refuses anything else, an unknown type included', () => {
        expect(refuseSource({ type: 'image/gif', size: 1000 })).not.toBeNull()
        expect(refuseSource({ type: '', size: 1000 })).not.toBeNull()
    })

    it('refuses a source too large to decode comfortably', () => {
        expect(refuseSource({ type: 'image/jpeg', size: 25 * 1024 * 1024 + 1 })).not.toBeNull()
    })
})

describe('outputSide', () => {
    it('brings a large crop down to twice the largest size', () => {
        expect(outputSide(square(3000))).toBe(576)
    })

    it('leaves a small crop as it is', () => {
        expect(outputSide(square(200.4))).toBe(200)
    })
})

describe('refuseCrop', () => {
    it('refuses what the server would refuse as too small', () => {
        expect(refuseCrop(square(95))).not.toBeNull()
        expect(refuseCrop(square(96))).toBeNull()
    })
})

describe('uploadError', () => {
    it('tells the two size refusals apart', () => {
        expect(uploadError(422, 'IMAGE_TOO_SMALL')).not.toBe(uploadError(422, 'IMAGE_TOO_LARGE'))
    })

    it('reads a 422 without a known code as unreadable', () => {
        expect(uploadError(422, 'IMAGE_UNSUPPORTED')).toBe(uploadError(422))
    })

    it('sends the reader to sign in on a lapsed session', () => {
        expect(uploadError(401, 'SESSION_EXPIRED')).toContain('войдите')
    })
})
