// Comment text is plain; the one thing drawn in it is a link (discussion-rules §4.6).

const URL_PATTERN = /https?:\/\/[^\s<>"']+/g
// what a sentence leaves stuck to the end of a URL
const TRAILING = /[.,;:!?)\]]+$/

export type Part = { kind: 'text'; text: string } | { kind: 'link'; href: string }

export function splitLinks(text: string): Part[] {
    const parts: Part[] = []
    let last = 0
    for (const match of text.matchAll(URL_PATTERN)) {
        const start = match.index
        const raw = match[0]
        const href = raw.replace(TRAILING, '')
        if (start > last) parts.push({ kind: 'text', text: text.slice(last, start) })
        parts.push({ kind: 'link', href })
        last = start + href.length
    }
    if (last < text.length) parts.push({ kind: 'text', text: text.slice(last) })
    return parts
}

export function countLinks(text: string): number {
    return splitLinks(text).filter((part) => part.kind === 'link').length
}
