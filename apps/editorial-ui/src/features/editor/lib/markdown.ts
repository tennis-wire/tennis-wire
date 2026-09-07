import { marked } from 'marked'

/**
 * Converts an assistant message to HTML for the editor and the clipboard.
 *
 * Deliberately separate from how the panel draws the bubble: react-markdown
 * handles the display, this feeds TipTap. Both read the same markdown, so what
 * lands in the document matches what was on screen.
 *
 * `async: false` selects marked's synchronous overload. Without it the return
 * type is `string | Promise<string>` and every call site has to await something
 * that never suspends.
 */
export function markdownToHtml(markdown: string): string {
    return marked.parse(markdown, { async: false, gfm: true, breaks: false })
}
