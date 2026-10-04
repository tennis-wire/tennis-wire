// Where uploaded files live: content-service's media.public-base-url, and the two must agree. The
// site shows pictures from there alone, so the editor keeps no other.
export const MEDIA_BASE_URL =
    (import.meta.env.VITE_MEDIA_BASE_URL ?? 'http://localhost:9000/media').replace(/\/+$/, '') + '/'

export function isOwnMedia(src: string | null | undefined): boolean {
    return !!src && src.startsWith(MEDIA_BASE_URL)
}

// Pasted or dropped html without the pictures and videos from elsewhere, each with the figure
// around it, so that its caption does not stay behind as a stray line. Untouched when there are
// none: the editor's own copy and paste carries markup it reads back.
export function stripForeignMedia(html: string): { html: string; dropped: number } {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    let dropped = 0
    for (const media of Array.from(doc.body.querySelectorAll('img, video'))) {
        const src = media.getAttribute('src') ?? media.querySelector('source')?.getAttribute('src')
        if (isOwnMedia(src)) continue
        ;(media.closest('figure') ?? media).remove()
        dropped++
    }
    return dropped === 0 ? { html, dropped } : { html: doc.body.innerHTML, dropped }
}
