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

// Everything the browser writes through here is a little JSON, but for the avatar: user-service
// takes up to 6 MB of multipart for that one
const BODY_LIMIT = 16 * 1024
const AVATAR_PATH = '/api/users/me/avatar'
const AVATAR_LIMIT = 6 * 1024 * 1024

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

    const limit = path === AVATAR_PATH ? AVATAR_LIMIT : BODY_LIMIT
    if (write && Number(request.headers.get('content-length')) > limit) {
        return json(413, 'PAYLOAD_TOO_LARGE')
    }

    let session = await readSession(request.cookies.get(SESSION_COOKIE)?.value)

    // Every write needs a reader, and the gateway would refuse this one: no reason to take the
    // body in first
    if (write && !session) return json(401, 'SIGN_IN_REQUIRED')

    // Before the refresh, so that a body turned away here does not take a refreshed cookie with it
    let body: Uint8Array<ArrayBuffer> | undefined
    if (write) {
        const read = await readBody(request, limit)
        if (!read) return json(413, 'PAYLOAD_TOO_LARGE')
        body = read
    }

    let refreshed: Session | null = null
    let signedOut = false

    if (session) {
        const fresh = await freshSession(session)
        // Neither signed in nor out as far as anyone can tell: the cookie stays as it is, and the
        // request is not sent on as anonymous, which would show him a thread that ignores his ignore
        if (fresh.status === 'unavailable') return json(503, 'AUTH_UNAVAILABLE')
        if (fresh.status === 'signed-out') {
            session = null
            signedOut = true
        } else if (fresh.session !== session) {
            session = fresh.session
            refreshed = fresh.session
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
            body,
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

// Content-Length is checked before this, but a chunked body comes without one
async function readBody(
    request: NextRequest,
    limit: number
): Promise<Uint8Array<ArrayBuffer> | null> {
    const chunks: Uint8Array[] = []
    let size = 0
    if (request.body) {
        const reader = request.body.getReader()
        for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
            size += chunk.value.byteLength
            if (size > limit) {
                await reader.cancel()
                return null
            }
            chunks.push(chunk.value)
        }
    }
    const body = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) {
        body.set(chunk, offset)
        offset += chunk.byteLength
    }
    return body
}

function clearSession(response: NextResponse): NextResponse {
    response.cookies.set(SESSION_COOKIE, '', { ...sessionCookieOptions(), maxAge: 0 })
    return response
}
