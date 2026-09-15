import { NextResponse, type NextRequest } from 'next/server'

import { freshSession } from '@/lib/auth/refresh'
import { SESSION_COOKIE, readSession, sealSession, sessionCookieOptions } from '@/lib/auth/session'
import { fetchProfile } from '@/lib/gateway/client'

// What the header and the comments need to draw themselves, and nothing else. No token leaves
// here. The id is the reader's own, and it is public anyway: every comment carries its author's.
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
            userId: profile?.userId ?? null,
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
