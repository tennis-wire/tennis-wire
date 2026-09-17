import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

import { GET } from './route'

const buildAuthorizationUrl = vi.fn()
vi.mock('openid-client', () => ({
    randomPKCECodeVerifier: () => 'verifier',
    randomState: () => 'state',
    randomNonce: () => 'nonce',
    calculatePKCECodeChallenge: async () => 'challenge',
    buildAuthorizationUrl: (...args: unknown[]) => buildAuthorizationUrl(...args),
}))

vi.mock('@/lib/auth/config', () => ({
    appOrigin: () => 'http://localhost:3000',
    callbackUrl: () => 'http://localhost:3000/api/auth/callback/keycloak',
    oidcConfig: async () => ({}),
}))

vi.mock('@/lib/auth/session', () => ({
    FLOW_COOKIE: 'tw_flow',
    flowCookieOptions: () => ({ httpOnly: true, sameSite: 'lax' as const, path: '/', maxAge: 1 }),
    sealFlow: vi.fn(async () => 'sealed-flow'),
}))

function login(query = '') {
    return new NextRequest(`http://localhost:3000/api/auth/login${query}`)
}

// What went to Keycloak in the authorization request
function sent(): Record<string, string> {
    return buildAuthorizationUrl.mock.calls[0][1]
}

beforeEach(() => {
    buildAuthorizationUrl.mockReset()
    buildAuthorizationUrl.mockReturnValue(new URL('http://localhost:8180/auth'))
})

describe('GET /api/auth/login', () => {
    it('asks Keycloak for a fresh login when told to', async () => {
        await GET(login('?prompt=login'))

        expect(sent().prompt).toBe('login')
    })

    it('passes no other prompt on', async () => {
        await GET(login('?prompt=none'))

        expect(sent()).not.toHaveProperty('prompt')
    })

    it('sends no prompt by default', async () => {
        await GET(login())

        expect(sent()).not.toHaveProperty('prompt')
    })
})
