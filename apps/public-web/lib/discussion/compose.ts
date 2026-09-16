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
