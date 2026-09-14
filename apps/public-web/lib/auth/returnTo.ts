/**
 * Where to send the reader once the login is done. Only a path inside this app
 * is allowed: an absolute URL, a protocol-relative one, or anything carrying
 * control characters turns the login endpoint into an open redirect.
 */
export function safeReturnTo(value: string | null | undefined): string {
    if (!value || !value.startsWith('/')) return '/'
    if (value.startsWith('//') || value.startsWith('/\\')) return '/'
    if ([...value].some((character) => character.charCodeAt(0) < 0x20)) return '/'
    return value
}

// Fallback for a plain <a href="/api/auth/login"> with no query: the browser
// sends the page the reader came from, and same-origin navigations carry the
// full path.
export function sameOriginPath(referer: string | null, origin: string): string | null {
    if (!referer) return null
    try {
        const url = new URL(referer)
        return url.origin === origin ? `${url.pathname}${url.search}` : null
    } catch {
        return null
    }
}
