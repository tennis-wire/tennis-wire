// Whatever was pasted from the site, down to the slug: a full address, a path, or the
// slug itself. /news/<slug> and /materials/<slug> both end in it.
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/

export function slugFromLink(input: string): string | null {
    const trimmed = input.trim()
    if (!trimmed) return null
    let path: string
    try {
        path = new URL(trimmed).pathname
    } catch {
        // not a full address: a path, or a host and a path without the scheme
        path = trimmed.split(/[?#]/)[0]
    }
    const segments = path.split('/').filter(Boolean)
    const last = segments[segments.length - 1]
    return last !== undefined && SLUG.test(last) ? last : null
}
