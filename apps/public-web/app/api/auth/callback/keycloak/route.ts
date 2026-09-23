import { NextResponse, type NextRequest } from 'next/server'
import * as client from 'openid-client'

import { appOrigin, oidcConfig } from '@/lib/auth/config'
import {
    FLOW_COOKIE,
    ID_TOKEN_COOKIE,
    SESSION_COOKIE,
    idTokenCookieOptions,
    readFlow,
    readSession,
    sealSession,
    sessionCookieOptions,
    type Session,
} from '@/lib/auth/session'
import { withoutDeletionMark } from '@/lib/auth/deletion'
import { safeReturnTo } from '@/lib/auth/returnTo'
import { mayEdit } from '@/lib/auth/roles'

function failed(reason: string, error?: unknown) {
    console.error('login failed: %s', reason, error)
    const response = NextResponse.redirect(new URL('/?login=failed', appOrigin()), { status: 303 })
    response.cookies.delete(FLOW_COOKIE)
    return response
}

// Every login with offline_access opens an offline session of its own, and the one it replaces
// would otherwise keep its refresh token working for thirty idle days with nobody holding it.
async function revoke(refreshToken: string) {
    try {
        await client.tokenRevocation(await oidcConfig(), refreshToken, {
            token_type_hint: 'refresh_token',
        })
    } catch (error) {
        console.error('revoking the replaced refresh token failed', error)
    }
}

export async function GET(request: NextRequest) {
    const flow = await readFlow(request.cookies.get(FLOW_COOKIE)?.value)
    if (!flow) return failed('no flow cookie')

    const previous = await readSession(request.cookies.get(SESSION_COOKIE)?.value)

    // Built from configuration rather than from request.url: the Host header
    // is the caller's to choose, and this URL is what the state, nonce and
    // PKCE checks are run against.
    const currentUrl = new URL(`${request.nextUrl.pathname}${request.nextUrl.search}`, appOrigin())

    let session: Session
    let idToken: string | undefined
    try {
        const config = await oidcConfig()
        const tokens = await client.authorizationCodeGrant(config, currentUrl, {
            pkceCodeVerifier: flow.codeVerifier,
            expectedState: flow.state,
            expectedNonce: flow.nonce,
        })

        const claims = tokens.claims()
        const sub = claims?.sub
        if (!sub) return failed('no sub in the id token')
        if (!tokens.refresh_token) return failed('no refresh token, offline_access did not apply')

        session = {
            sub,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            accessExpiresAt: Math.floor(Date.now() / 1000) + (tokens.expiresIn() ?? 0),
            canEdit: mayEdit(claims),
        }
        idToken = tokens.id_token
    } catch (error) {
        return failed('code exchange rejected', error)
    }

    // Only once the new session exists: a login that failed keeps the one the reader had
    if (previous) await revoke(previous.refreshToken)

    const returnTo = safeReturnTo(flow.returnTo)
    const sameAccount = previous?.sub === session.sub
    const response = NextResponse.redirect(
        new URL(sameAccount ? returnTo : withoutDeletionMark(returnTo), appOrigin()),
        { status: 303 }
    )
    response.cookies.set(SESSION_COOKIE, await sealSession(session), sessionCookieOptions())
    if (idToken) response.cookies.set(ID_TOKEN_COOKIE, idToken, idTokenCookieOptions())
    response.cookies.delete(FLOW_COOKIE)
    return response
}
