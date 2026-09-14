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
