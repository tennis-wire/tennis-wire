import { DiscussionError, NetworkError } from './api'
import { countLinks } from './text'

// The rules for comment text, applied before a comment leaves the device. The service checks the
// length again (2000 as well) and not the links.
export const MAX_LENGTH = 2000
export const MAX_LINKS = 3

// Edges trimmed, trailing spaces off each line, runs of blank lines cut to one
export function normalize(text: string): string {
    return text
        .replace(/\r\n?/g, '\n')
        .replace(/[ \t]+$/gm, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
}

export type Problem = 'empty' | 'long' | 'links'

// What stops the text from going, if anything. Length is counted the way the service counts it:
// UTF-16 units, so an emoji is two.
export function problem(text: string): Problem | null {
    const body = normalize(text)
    if (body.length === 0) return 'empty'
    if (body.length > MAX_LENGTH) return 'long'
    if (countLinks(body) > MAX_LINKS) return 'links'
    return null
}

export type Keyed = { body: string; key: string }

// The key a text goes under. The same text sent again keeps its key, "Retry" included, so an answer
// that never arrived costs no second comment. A changed text is another comment and gets a key of its
// own: under the old one the service would refuse it.
export function keyFor(
    previous: Keyed | null,
    body: string,
    newKey: () => string = () => crypto.randomUUID()
): Keyed {
    return previous?.body === body ? previous : { body, key: newKey() }
}

export type Failure =
    { kind: 'network' } | { kind: 'rate' } | { kind: 'parent' } | { kind: 'other'; message: string }

// What the form says when sending failed. A reply finds its parent gone in two ways: 409
// PARENT_DELETED while replies still hold the parent up, 404 once it had none and went
// altogether. The reader is told the same either way.
export function classify(error: unknown, replying: boolean): Failure {
    if (error instanceof NetworkError) return { kind: 'network' }
    if (error instanceof DiscussionError) {
        if (error.status === 429) return { kind: 'rate' }
        if (error.code === 'PARENT_DELETED' || (replying && error.status === 404)) {
            return { kind: 'parent' }
        }
        if (error.status >= 500 || error.code === 'GATEWAY_UNAVAILABLE') return { kind: 'network' }
        return { kind: 'other', message: error.message }
    }
    return { kind: 'network' }
}
