import { NextResponse, type NextRequest } from 'next/server'

import { editorialOrigin } from '@/lib/auth/config'
import { freshSession } from '@/lib/auth/refresh'
import {
    SESSION_COOKIE,
    readSession,
    sealSession,
    sessionCookieOptions,
    type Session,
} from '@/lib/auth/session'
import { fetchProfile, type Profile } from '@/lib/gateway/client'

// What the header and the comments need to draw themselves, and nothing else. No token leaves
// here. The id is the reader's own, and it is public anyway: every comment carries its author's.
const NO_STORE = { 'cache-control': 'no-store' }

export async function GET(request: NextRequest) {
    const stored = await readSession(request.cookies.get(SESSION_COOKIE)?.value)
    if (!stored) return NextResponse.json({ authenticated: false }, { headers: NO_STORE })

    const fresh = await freshSession(stored)
    if (fresh.status === 'signed-out') {
        const response = NextResponse.json({ authenticated: false }, { headers: NO_STORE })
        response.cookies.set(SESSION_COOKIE, '', { ...sessionCookieOptions(), maxAge: 0 })
        return response
    }
    // Keycloak did not answer. Still signed in as far as anyone knows, just with nothing to show
    // for a name, as when user-service does not answer.
    if (fresh.status === 'unavailable') {
        return NextResponse.json(signedIn(stored, null), { headers: NO_STORE })
    }

    const session = fresh.session
    const profile = await fetchProfile(session.accessToken)
    const response = NextResponse.json(signedIn(session, profile), { headers: NO_STORE })
    if (session !== stored) {
        response.cookies.set(SESSION_COOKIE, await sealSession(session), sessionCookieOptions())
    }
    return response
}

function signedIn(session: Session, profile: Profile | null) {
    return {
        authenticated: true,
        userId: profile?.userId ?? null,
        displayName: profile?.displayName ?? null,
        // Unknown means do not nag: a user-service that did not answer is
        // no reason to send the reader to the rename screen.
        displayNameChosen: profile?.displayNameChosen ?? true,
        createdAt: profile?.createdAt ?? null,
        avatarUrl: profile?.avatarUrl ?? null,
        avatarLargeUrl: profile?.avatarLargeUrl ?? null,
        // Only to staff: the public HTML says nothing about the editor, not even where it is
        editorialOrigin: session.canEdit ? editorialOrigin() : null,
    }
}
