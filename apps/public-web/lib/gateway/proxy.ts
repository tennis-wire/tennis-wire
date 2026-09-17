import { NextResponse, type NextRequest } from 'next/server'

import { appOrigin } from '@/lib/auth/config'
import { freshSession } from '@/lib/auth/refresh'
import {
    SESSION_COOKIE,
    readSession,
    sealSession,
    sessionCookieOptions,
    type Session,
} from '@/lib/auth/session'
import { gatewayOrigin } from './client'
import { clientAddress, takeToken } from './rateLimit'

// The request is rebuilt, never forwarded. Anything not listed here stays on
// this side: Cookie, Host and X-Forwarded-* in particular. The sealed session
// has no business in the logs of hops that cannot read it, and a forwarded XFF
// would break the gateway's key resolver. Idempotency-Key goes through: without
// it a comment sent again after a lost answer is written twice.
const REQUEST_HEADERS = ['content-type', 'accept', 'idempotency-key']
const RESPONSE_HEADERS = ['content-type']

function json(status: number, code: string) {
    return NextResponse.json({ code }, { status })
}

export async function proxy(request: NextRequest, prefix: string): Promise<NextResponse> {
    const path = request.nextUrl.pathname
    if (!path.startsWith(prefix)) return json(404, 'NOT_FOUND')

    const write = request.method !== 'GET' && request.method !== 'HEAD'

    // SameSite=Lax already keeps cross-site POSTs away from the cookie; this
    // covers the rest, and costs nothing.
    if (write && request.headers.get('origin') !== appOrigin()) {
        return json(403, 'BAD_ORIGIN')
    }

    let session = await readSession(request.cookies.get(SESSION_COOKIE)?.value)
    let refreshed: Session | null = null
    let signedOut = false

    if (session) {
        const fresh = await freshSession(session)
        if (!fresh) {
            session = null
            signedOut = true
        } else if (fresh !== session) {
            session = fresh
            refreshed = fresh
        }
    }

    if (signedOut && write) return clearSession(json(401, 'SESSION_EXPIRED'))

    if (!session) {
        const key = clientAddress(request.headers.get('x-forwarded-for')) ?? 'unknown'
        if (!takeToken(key)) return json(429, 'TOO_MANY_REQUESTS')
    }

    const headers = new Headers()
    for (const name of REQUEST_HEADERS) {
        const value = request.headers.get(name)
        if (value) headers.set(name, value)
    }
    if (session) headers.set('authorization', `Bearer ${session.accessToken}`)

    let upstream: Response
    try {
        upstream = await fetch(`${gatewayOrigin()}${path}${request.nextUrl.search}`, {
            method: request.method,
            headers,
            body: write ? await request.arrayBuffer() : undefined,
            redirect: 'manual',
            cache: 'no-store',
        })
    } catch (error) {
        console.error('gateway unreachable: %s %s', request.method, path, error)
        return json(502, 'GATEWAY_UNAVAILABLE')
    }

    const response = new NextResponse(upstream.body, { status: upstream.status })
    for (const name of RESPONSE_HEADERS) {
        const value = upstream.headers.get(name)
        if (value) response.headers.set(name, value)
    }

    if (refreshed)
        response.cookies.set(SESSION_COOKIE, await sealSession(refreshed), sessionCookieOptions())
    if (signedOut) clearSession(response)
    return response
}

function clearSession(response: NextResponse): NextResponse {
    response.cookies.set(SESSION_COOKIE, '', { ...sessionCookieOptions(), maxAge: 0 })
    return response
}
