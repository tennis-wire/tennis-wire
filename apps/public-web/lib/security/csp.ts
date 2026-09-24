import { EMBED_HOSTS } from '@/lib/content/embeds'

// theme/fonts.ts loads the font pairs from Google: the stylesheet from one host, the files from
// the other
const GOOGLE_FONTS_CSS = 'https://fonts.googleapis.com'
const GOOGLE_FONTS_FILES = 'https://fonts.gstatic.com'

export type PolicySources = {
    dev: boolean
    // the media bucket: covers, pictures in articles, avatars
    media: string | null
    // the logout form lands there through a redirect, and Chrome checks form-action on those
    keycloak: string | null
}

// No nonce: reading one per request makes every page dynamic and takes ISR away. So inline
// scripts stay allowed, which Next's own payload and the theme boot script need anyway. What
// is left still counts: no script or style from anywhere else, frames only from the embeds the
// sanitizer lets through, no plugins, no <base>, and no framing of this site.
export function contentSecurityPolicy({ dev, media, keycloak }: PolicySources): string {
    const directives: [string, ...(string | null | false)[]][] = [
        ['default-src', "'self'"],
        // eval is for React's dev tooling only
        ['script-src', "'self'", "'unsafe-inline'", dev && "'unsafe-eval'"],
        // React renders style attributes into the server markup
        ['style-src', "'self'", "'unsafe-inline'", GOOGLE_FONTS_CSS],
        ['font-src', "'self'", GOOGLE_FONTS_FILES],
        // blob: is the avatar cropper's picture of the chosen file
        ['img-src', "'self'", 'data:', 'blob:', media],
        ['media-src', "'self'", media],
        ['frame-src', ...EMBED_HOSTS.map((host) => `https://${host}`)],
        ['connect-src', "'self'"],
        ['object-src', "'none'"],
        ['base-uri', "'self'"],
        ['form-action', "'self'", keycloak],
        ['frame-ancestors', "'none'"],
    ]
    return directives
        .map((directive) => directive.filter((part) => typeof part === 'string').join(' '))
        .join('; ')
}

// Only the origin counts in a CSP source: a bucket URL with a path is taken as its host
export function originOf(value: string | undefined): string | null {
    if (!value) return null
    try {
        const url = new URL(value)
        return url.protocol === 'http:' || url.protocol === 'https:' ? url.origin : null
    } catch {
        return null
    }
}

export function pagePolicy(): string {
    return contentSecurityPolicy({
        dev: process.env.NODE_ENV === 'development',
        media: originOf(process.env.MEDIA_ORIGIN),
        keycloak: originOf(process.env.KEYCLOAK_ISSUER),
    })
}
