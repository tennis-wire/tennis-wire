// The single place through which the editorial UI talks to the backend.
//
// Every request goes to the API gateway. It is the only backend host this app
// knows about and the only origin CORS is configured for; the services behind
// it carry no CORS of their own, so addressing them directly cannot work.
//
// Today this only joins the path to the host. It exists so that the
// Authorization header, the token refresh and the 401 policy have exactly one
// place to live once login lands.

const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL ?? 'http://localhost:8090'

/**
 * @param path gateway path starting with a slash, e.g. '/api/editorial/articles'
 */
export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
    return fetch(`${GATEWAY_URL}${path}`, init)
}
