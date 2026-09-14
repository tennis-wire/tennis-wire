import { NextResponse, type NextRequest } from 'next/server'
import * as client from 'openid-client'

import { callbackUrl, oidcConfig } from '@/lib/auth/config'
import { FLOW_COOKIE, flowCookieOptions, sealFlow } from '@/lib/auth/session'
import { safeReturnTo } from '@/lib/auth/returnTo'

export async function GET(request: NextRequest) {
    const config = await oidcConfig()

    const codeVerifier = client.randomPKCECodeVerifier()
    const state = client.randomState()
    const nonce = client.randomNonce()

    const authorizationUrl = client.buildAuthorizationUrl(config, {
        redirect_uri: callbackUrl(),
        // offline_access is what makes the session outlive the eight-hour SSO
        // session: the refresh token keeps working for thirty idle days.
        scope: 'openid profile email offline_access',
        code_challenge: await client.calculatePKCECodeChallenge(codeVerifier),
        code_challenge_method: 'S256',
        state,
        nonce,
    })

    const flow = await sealFlow({
        codeVerifier,
        state,
        nonce,
        returnTo: safeReturnTo(request.nextUrl.searchParams.get('returnTo')),
    })

    const response = NextResponse.redirect(authorizationUrl, { status: 303 })
    response.cookies.set(FLOW_COOKIE, flow, flowCookieOptions())
    return response
}
