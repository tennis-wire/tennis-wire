// The request policy, with its dependencies handed in.
//
// Kept separate from the wiring so it can be tested without a UserManager, a
// browser or a network: everything it needs arrives through deps.

export interface ApiFetchDeps {
    /** Origin of the API gateway, without a trailing slash. */
    baseUrl: string
    /** Current access token, or null when there is none worth sending. */
    getAccessToken: () => Promise<string | null>
    /** Obtains a fresh token. Returns null when the session is gone. */
    refresh: () => Promise<string | null>
    /** Called once when refresh fails and the session cannot be saved. */
    onSessionExpired: () => void
    fetchImpl?: typeof fetch
}

export function createApiFetch(deps: ApiFetchDeps) {
    const doFetch = deps.fetchImpl ?? globalThis.fetch
    // One refresh at a time. The transcription poller alone can put several
    // requests in flight, and each of them hitting an expired token would
    // otherwise fire its own refresh — which, with rotation enabled, is how a
    // session gets torn down by its own client.
    let inFlight: Promise<string | null> | null = null

    function refreshOnce(): Promise<string | null> {
        inFlight ??= deps
            .refresh()
            .catch(() => null)
            .finally(() => {
                inFlight = null
            })
        return inFlight
    }

    function send(path: string, init: RequestInit | undefined, token: string | null) {
        const headers = new Headers(init?.headers)
        if (token !== null) headers.set('Authorization', `Bearer ${token}`)
        return doFetch(`${deps.baseUrl}${path}`, { ...init, headers })
    }

    /**
     * @param path gateway path starting with a slash, e.g. '/api/editorial/articles'
     */
    return async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
        const response = await send(path, init, await deps.getAccessToken())

        // 403 means the token is fine and the role is not. Retrying changes
        // nothing; only an administrator can.
        if (response.status !== 401) return response

        const token = await refreshOnce()
        if (token === null) {
            deps.onSessionExpired()
            return response
        }
        // Bodies here are strings or FormData, both of which survive being
        // handed to fetch twice. A streamed body would not.
        return send(path, init, token)
    }
}
