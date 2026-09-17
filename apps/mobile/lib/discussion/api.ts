// Mirrors public-web/lib/discussion/api.ts. There `path` is relative, fetched against the
// Next.js server's own origin, which proxies to the gateway and attaches the session's bearer
// token itself. Mobile has no such hop: `path` here is joined to gatewayOrigin() directly, and
// accessToken is threaded through explicitly instead of read from a cookie.

import { gatewayOrigin } from '../auth/config'

export const TIMEOUT_MS = 10_000
export const RETRY_AFTER_MS = 3_000

// What the service answered with a status: {error, message, details?, violations?}.
export class DiscussionError extends Error {
    constructor(
        readonly status: number,
        readonly code: string,
        message: string,
        readonly details: Record<string, unknown> = {}
    ) {
        super(message)
        this.name = 'DiscussionError'
    }
}

// No answer at all: offline, or nothing within the timeout.
export class NetworkError extends Error {
    constructor(readonly reason: 'timeout' | 'offline') {
        super(reason)
        this.name = 'NetworkError'
    }
}

export function isRetryable(error: unknown): boolean {
    if (error instanceof NetworkError) return true
    return error instanceof DiscussionError && (error.status >= 500 || error.status === 429)
}

async function toError(response: Response): Promise<DiscussionError> {
    let body: {
        error?: string
        code?: string
        message?: string
        details?: Record<string, unknown>
    } = {}
    try {
        body = await response.json()
    } catch {
        // a body that is not JSON says nothing more than the status did
    }
    const code = body.error ?? body.code ?? `HTTP_${response.status}`
    return new DiscussionError(response.status, code, body.message ?? code, body.details ?? {})
}

export async function once<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: unknown,
    idempotencyKey?: string,
    accessToken?: string
): Promise<T> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    let response: Response
    try {
        response = await fetch(`${gatewayOrigin()}${path}`, {
            method,
            headers: {
                accept: 'application/json',
                ...(body === undefined ? {} : { 'content-type': 'application/json' }),
                ...(idempotencyKey === undefined ? {} : { 'idempotency-key': idempotencyKey }),
                ...(accessToken === undefined ? {} : { authorization: `Bearer ${accessToken}` }),
            },
            body: body === undefined ? undefined : JSON.stringify(body),
            signal: controller.signal,
        })
    } catch {
        throw new NetworkError(controller.signal.aborted ? 'timeout' : 'offline')
    } finally {
        clearTimeout(timer)
    }
    if (!response.ok) throw await toError(response)
    if (response.status === 204) return undefined as T
    return (await response.json()) as T
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

// A read: one silent retry after a pause, for what a second try can fix: no answer, a 5xx, or a
// 429. A 4xx is an answer and stands. accessToken is optional: an anonymous reader can still read.
export async function read<T>(path: string, accessToken?: string): Promise<T> {
    try {
        return await once<T>('GET', path, undefined, undefined, accessToken)
    } catch (error) {
        if (!isRetryable(error)) throw error
        await sleep(RETRY_AFTER_MS)
        return once<T>('GET', path, undefined, undefined, accessToken)
    }
}

// A write: one request and no retry of its own; a retry is the reader's, by hand. A comment goes
// with an idempotency key, and a retry under the same key cannot land it twice. accessToken is
// required: every write needs a signed-in reader.
export function write<T>(
    method: 'POST' | 'PUT' | 'DELETE',
    path: string,
    accessToken: string,
    body?: unknown,
    idempotencyKey?: string
): Promise<T> {
    return once<T>(method, path, body, idempotencyKey, accessToken)
}
