// @vitest-environment jsdom
import { Editor } from '@tiptap/core'
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import { describe, expect, it } from 'vitest'

import { Poll } from './Poll'

function editor(content?: string): Editor {
    return new Editor({ extensions: [Document, Paragraph, Text, Poll], content })
}

const attrs = { pollId: 'p1', question: 'Who wins?', options: ['Sinner', 'Alcaraz'] }

describe('Poll node', () => {
    it('writes the id, the question and the options into the article', () => {
        const e = editor()
        e.commands.setPoll(attrs)

        expect(e.getHTML()).toBe(
            '<div data-poll="p1" class="poll-embed"><p class="poll-question">Who wins?</p>' +
                '<ol class="poll-options"><li>Sinner</li><li>Alcaraz</li></ol></div>'
        )
    })

    it('reads its own output back, so a saved draft keeps the poll', () => {
        const html = editor()
        html.commands.setPoll(attrs)

        const reread = editor(html.getHTML())

        expect(reread.getJSON().content?.[0]).toEqual({ type: 'poll', attrs })
        expect(reread.getHTML()).toBe(html.getHTML())
    })

    it('shrugs at markup it did not write', () => {
        const e = editor('<div data-poll="p2"></div>')

        expect(e.getJSON().content?.[0]).toEqual({
            type: 'poll',
            attrs: { pollId: 'p2', question: '', options: [] },
        })
    })
})
