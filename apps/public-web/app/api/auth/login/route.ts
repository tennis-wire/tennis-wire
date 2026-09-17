import { NextResponse, type NextRequest } from 'next/server'
import * as client from 'openid-client'

import { appOrigin, callbackUrl, oidcConfig } from '@/lib/auth/config'
import { FLOW_COOKIE, flowCookieOptions, sealFlow } from '@/lib/auth/session'
import { safeReturnTo, sameOriginPath } from '@/lib/auth/returnTo'

export async function GET(request: NextRequest) {
    const config = await oidcConfig()

    const codeVerifier = client.randomPKCECodeVerifier()
    const state = client.randomState()
    const nonce = client.randomNonce()

    const authorizationUrl = client.buildAuthorizationUrl(config, {
        redirect_uri: callbackUrl(),
        // offline_access keeps the refresh token working for thirty idle days. Since
        // Keycloak 26.1 such a login leaves no SSO session behind.
        scope: 'openid profile email offline_access',
        code_challenge: await client.calculatePKCECodeChallenge(codeVerifier),
        code_challenge_method: 'S256',
        state,
        nonce,
        // Only "login", which deleting an account asks for. No other value is passed on.
        ...(request.nextUrl.searchParams.get('prompt') === 'login' ? { prompt: 'login' } : {}),
    })

    const flow = await sealFlow({
        codeVerifier,
        state,
        nonce,
        returnTo: safeReturnTo(
            request.nextUrl.searchParams.get('returnTo') ??
                sameOriginPath(request.headers.get('referer'), appOrigin())
        ),
    })

    const response = NextResponse.redirect(authorizationUrl, { status: 303 })
    response.cookies.set(FLOW_COOKIE, flow, flowCookieOptions())
    return response
}
