// The one place a request to the discussion proxy is made from. Reads get a timeout and a single
// silent retry; writes get the timeout only.

export const TIMEOUT_MS = 10_000
export const RETRY_AFTER_MS = 3_000

// What the service (or the proxy) answered with a status. The service sends
// {error, message, details?, violations?}; the proxy's own refusals send {code}.
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
    idempotencyKey?: string
): Promise<T> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    let response: Response
    try {
        response = await fetch(path, {
            method,
            headers: {
                accept: 'application/json',
                ...(body === undefined ? {} : { 'content-type': 'application/json' }),
                ...(idempotencyKey === undefined ? {} : { 'idempotency-key': idempotencyKey }),
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

// A read: one silent retry after a pause, for what a second try can fix: no answer, a 5xx, or
// the proxy's 429, whose bucket refills at 5/s. A 4xx is an answer and stands.
export async function read<T>(path: string): Promise<T> {
    try {
        return await once<T>('GET', path)
    } catch (error) {
        if (!isRetryable(error)) throw error
        await sleep(RETRY_AFTER_MS)
        return once<T>('GET', path)
    }
}

// A write: one request and no retry of its own; a retry is the reader's, by hand. A comment goes
// with an idempotency key, and a retry under the same key cannot land it twice.
export function write<T>(
    method: 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: unknown,
    idempotencyKey?: string
): Promise<T> {
    return once<T>(method, path, body, idempotencyKey)
}
