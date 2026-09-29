import type { JSONContent } from '@tiptap/core'

// Plain text from DeepL or a transcript, as the editor's paragraphs: a blank line starts a new one,
// a single newline is a line break. Nodes rather than HTML, so a < or & in the text stays text.
export function paragraphsOf(text: string): JSONContent[] {
    return text
        .replace(/\r\n?/g, '\n')
        .split(/\n\s*\n/)
        .map((block) => block.trim())
        .filter(Boolean)
        .map((block) => ({
            type: 'paragraph',
            content: block
                .split('\n')
                .flatMap((line, i): JSONContent[] => [
                    ...(i > 0 ? [{ type: 'hardBreak' }] : []),
                    ...(line ? [{ type: 'text', text: line }] : []),
                ]),
        }))
}
