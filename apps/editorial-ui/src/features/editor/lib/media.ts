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

// Where a pasted picture really is. Sites that load pictures lazily put a stand-in in src and the
// picture in data-src or srcset, whose last entry is the largest by habit.
function sourceOf(img: Element): string | null {
    const srcset = img.getAttribute('srcset')?.split(',').pop()?.trim().split(/\s+/)[0]
    const candidates = [img.getAttribute('data-src'), srcset, img.getAttribute('src')]
    return candidates.find((link) => !!link && /^https?:\/\//i.test(link)) ?? null
}

// The pictures from elsewhere in pasted html that could be copied in, each once
export function foreignPictureLinks(html: string): string[] {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const links = Array.from(doc.body.querySelectorAll('img'), sourceOf)
    return [...new Set(links.filter((link): link is string => !!link && !isOwnMedia(link)))]
}

// The same html with the copies made in the bucket in place of the pictures they were made from
export function withCopies(html: string, copies: Map<string, string>): string {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    for (const img of Array.from(doc.body.querySelectorAll('img'))) {
        const copy = copies.get(sourceOf(img) ?? '')
        if (!copy) continue
        img.setAttribute('src', copy)
        img.removeAttribute('srcset')
        img.removeAttribute('data-src')
    }
    return doc.body.innerHTML
}
