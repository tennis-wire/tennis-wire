import { NextResponse, type NextRequest } from 'next/server'

import { freshSession } from '@/lib/auth/refresh'
import { SESSION_COOKIE, readSession, sealSession, sessionCookieOptions } from '@/lib/auth/session'
import { fetchProfile } from '@/lib/gateway/client'

// What the header needs to draw itself, and nothing else. No token leaves here.
const NO_STORE = { 'cache-control': 'no-store' }

export async function GET(request: NextRequest) {
    const stored = await readSession(request.cookies.get(SESSION_COOKIE)?.value)
    if (!stored) return NextResponse.json({ authenticated: false }, { headers: NO_STORE })

    const session = await freshSession(stored)
    if (!session) {
        const response = NextResponse.json({ authenticated: false }, { headers: NO_STORE })
        response.cookies.set(SESSION_COOKIE, '', { ...sessionCookieOptions(), maxAge: 0 })
        return response
    }

    const profile = await fetchProfile(session.accessToken)
    const response = NextResponse.json(
        {
            authenticated: true,
            displayName: profile?.displayName ?? null,
            // Unknown means do not nag: a user-service that did not answer is
            // no reason to send the reader to the rename screen.
            displayNameChosen: profile?.displayNameChosen ?? true,
        },
        { headers: NO_STORE }
    )
    if (session !== stored) {
        response.cookies.set(SESSION_COOKIE, await sealSession(session), sessionCookieOptions())
    }
    return response
}
