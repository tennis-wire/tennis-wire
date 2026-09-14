import { NextResponse, type NextRequest } from 'next/server'
import * as client from 'openid-client'

import { appOrigin, oidcConfig } from '@/lib/auth/config'
import {
    ID_TOKEN_COOKIE,
    SESSION_COOKIE,
    idTokenCookieOptions,
    readSession,
    sessionCookieOptions,
} from '@/lib/auth/session'

export async function POST(request: NextRequest) {
    const origin = request.headers.get('origin')
    if (origin !== null && origin !== appOrigin()) {
        return new NextResponse('cross-origin logout', { status: 403 })
    }

    const config = await oidcConfig()
    const session = await readSession(request.cookies.get(SESSION_COOKIE)?.value)

    if (session) {
        // Ending the Keycloak session does not touch an offline token — that is
        // the point of one. Without this the reader logs out and the refresh
        // token in the cookie they just dropped keeps working for thirty days.
        try {
            await client.tokenRevocation(config, session.refreshToken, {
                token_type_hint: 'refresh_token',
            })
        } catch (error) {
            console.error('refresh token revocation failed', error)
        }
    }

    const idToken = request.cookies.get(ID_TOKEN_COOKIE)?.value
    const destination = idToken
        ? client.buildEndSessionUrl(config, {
              id_token_hint: idToken,
              post_logout_redirect_uri: `${appOrigin()}/`,
          })
        : new URL('/', appOrigin())

    const response = NextResponse.redirect(destination, { status: 303 })
    response.cookies.set(SESSION_COOKIE, '', { ...sessionCookieOptions(), maxAge: 0 })
    response.cookies.set(ID_TOKEN_COOKIE, '', { ...idTokenCookieOptions(), maxAge: 0 })
    return response
}
