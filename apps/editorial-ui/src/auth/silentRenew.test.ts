import { describe, expect, it } from 'vitest'
import { ErrorResponse, ErrorTimeout } from 'oidc-client-ts'

import { isDeadSession } from './silentRenew'

describe('isDeadSession', () => {
    it('recognises a refused refresh token', () => {
        expect(isDeadSession(new ErrorResponse({ error: 'invalid_grant' }))).toBe(true)
    })

    it('does not read other provider errors as a dead session', () => {
        expect(isDeadSession(new ErrorResponse({ error: 'temporarily_unavailable' }))).toBe(false)
    })

    it('does not read a failed fetch as a dead session', () => {
        expect(isDeadSession(new TypeError('Failed to fetch'))).toBe(false)
    })

    it('does not read a timeout as a dead session', () => {
        expect(isDeadSession(new ErrorTimeout('Network timed out'))).toBe(false)
    })

    it('survives being handed nothing', () => {
        expect(isDeadSession(undefined)).toBe(false)
    })
})
