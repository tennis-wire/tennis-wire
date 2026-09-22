// The editor writes a poll as a block of its own at the top level of the article, holding only
// <p> and <ol>, so the first </div> after it closes it. Anything more, and this stays as text.
const POLL_BLOCK = /<div data-poll="([^"]+)"[^>]*>[\s\S]*?<\/div>/g

export type Piece = { html: string } | { pollId: string; fallback: string }

// The sanitized article, cut where a poll stands: html between, the poll block as it came
export function splitPolls(html: string): Piece[] {
    const pieces: Piece[] = []
    let last = 0
    for (const match of html.matchAll(POLL_BLOCK)) {
        const at = match.index
        if (at > last) pieces.push({ html: html.slice(last, at) })
        pieces.push({ pollId: match[1], fallback: match[0] })
        last = at + match[0].length
    }
    if (last < html.length || pieces.length === 0) pieces.push({ html: html.slice(last) })
    return pieces
}
