import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

import { GET } from './route'

const authorizationCodeGrant = vi.fn()
const tokenRevocation = vi.fn()
vi.mock('openid-client', () => ({
    authorizationCodeGrant: (...args: unknown[]) => authorizationCodeGrant(...args),
    tokenRevocation: (...args: unknown[]) => tokenRevocation(...args),
}))

vi.mock('@/lib/auth/config', () => ({
    appOrigin: () => 'http://localhost:3000',
    oidcConfig: async () => ({}),
}))

const flow = { codeVerifier: 'verifier', state: 'state', nonce: 'nonce', returnTo: '/news/one' }
const signedIn = {
    sub: 'reader-1',
    accessToken: 'old-access',
    refreshToken: 'old-refresh',
    accessExpiresAt: 9_999_999_999,
}

vi.mock('@/lib/auth/session', () => ({
    FLOW_COOKIE: 'tw_flow',
    SESSION_COOKIE: 'tw_session',
    ID_TOKEN_COOKIE: 'tw_idt',
    sessionCookieOptions: () => ({
        httpOnly: true,
        sameSite: 'lax' as const,
        path: '/',
        maxAge: 1,
    }),
    idTokenCookieOptions: () => ({
        httpOnly: true,
        sameSite: 'lax' as const,
        path: '/api/auth/logout',
        maxAge: 1,
    }),
    readFlow: vi.fn(async (seal?: string) => (seal === 'flow' ? flow : null)),
    readSession: vi.fn(async (seal?: string) => (seal === 'signed-in' ? signedIn : null)),
    sealSession: vi.fn(async () => 'sealed'),
}))

function tokensFor(sub: string) {
    return {
        access_token: 'new-access',
        refresh_token: 'new-refresh',
        id_token: 'new-id',
        claims: () => ({ sub }),
        expiresIn: () => 60,
    }
}

function callback(session?: string) {
    const headers = new Headers()
    headers.set('cookie', session ? `tw_flow=flow; tw_session=${session}` : 'tw_flow=flow')
    return new NextRequest('http://localhost:3000/api/auth/callback/keycloak?code=c&state=state', {
        headers,
    })
}

beforeEach(() => {
    flow.returnTo = '/news/one'
    authorizationCodeGrant.mockReset()
    tokenRevocation.mockReset()
    vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('GET /api/auth/callback/keycloak', () => {
    it('revokes the refresh token of the session it replaces', async () => {
        authorizationCodeGrant.mockResolvedValue(tokensFor('reader-1'))

        const response = await GET(callback('signed-in'))

        expect(response.status).toBe(303)
        expect(response.cookies.get('tw_session')?.value).toBe('sealed')
        expect(tokenRevocation).toHaveBeenCalledWith(expect.anything(), 'old-refresh', {
            token_type_hint: 'refresh_token',
        })
    })

    it('revokes nothing when nobody was signed in', async () => {
        authorizationCodeGrant.mockResolvedValue(tokensFor('reader-1'))

        await GET(callback())

        expect(tokenRevocation).not.toHaveBeenCalled()
    })

    it('keeps the session the reader had when the code is refused', async () => {
        authorizationCodeGrant.mockRejectedValue(new Error('invalid_grant'))

        const response = await GET(callback('signed-in'))

        expect(response.headers.get('location')).toBe('http://localhost:3000/?login=failed')
        expect(response.cookies.get('tw_session')).toBeUndefined()
        expect(tokenRevocation).not.toHaveBeenCalled()
    })

    it('signs the reader in even when the old token cannot be revoked', async () => {
        authorizationCodeGrant.mockResolvedValue(tokensFor('reader-1'))
        tokenRevocation.mockRejectedValue(new Error('keycloak is down'))

        const response = await GET(callback('signed-in'))

        expect(response.headers.get('location')).toBe('http://localhost:3000/news/one')
        expect(response.cookies.get('tw_session')?.value).toBe('sealed')
    })

    describe('the mark that opens the last step of deleting an account', () => {
        const marked = '/me/settings/actions?delete=confirmed'

        it('comes back with the account that left for the login', async () => {
            flow.returnTo = marked
            authorizationCodeGrant.mockResolvedValue(tokensFor('reader-1'))

            const response = await GET(callback('signed-in'))

            expect(response.headers.get('location')).toBe(`http://localhost:3000${marked}`)
        })

        it('is dropped when another account comes back', async () => {
            flow.returnTo = marked
            authorizationCodeGrant.mockResolvedValue(tokensFor('reader-2'))

            const response = await GET(callback('signed-in'))

            expect(response.headers.get('location')).toBe(
                'http://localhost:3000/me/settings/actions'
            )
        })

        it('is dropped when nobody was signed in before', async () => {
            flow.returnTo = marked
            authorizationCodeGrant.mockResolvedValue(tokensFor('reader-1'))

            const response = await GET(callback())

            expect(response.headers.get('location')).toBe(
                'http://localhost:3000/me/settings/actions'
            )
        })
    })
})
