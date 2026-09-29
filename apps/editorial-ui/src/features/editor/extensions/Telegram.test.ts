// @vitest-environment jsdom
import { Editor } from '@tiptap/core'
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import { describe, expect, it } from 'vitest'

import { Telegram } from './Telegram'

function editor(content?: string): Editor {
    return new Editor({ extensions: [Document, Paragraph, Text, Telegram], content })
}

const POST = 'https://t.me/tennis_bolshe/30998'

describe('Telegram node', () => {
    it('writes the post into the article', () => {
        const e = editor()
        e.commands.setTelegramPost({ src: POST })

        const html = e.getHTML()
        expect(html).toContain(
            '<div data-telegram-post="tennis_bolshe/30998" class="telegram-embed">'
        )
        expect(html).toContain(
            '<iframe src="https://t.me/tennis_bolshe/30998?embed=1&amp;mode=tme"'
        )
    })

    it('reads its own output back, so saving a reopened article keeps the post', () => {
        const e = editor()
        e.commands.setTelegramPost({ src: POST })

        const reread = editor(e.getHTML())

        expect(reread.getJSON().content?.[0]).toEqual({
            type: 'telegram',
            attrs: { channel: 'tennis_bolshe', postId: '30998' },
        })
        expect(reread.getHTML()).toBe(e.getHTML())
    })

    it('takes no post from a link it cannot read', () => {
        const e = editor()

        expect(e.commands.setTelegramPost({ src: 'https://t.me/tennis_bolshe' })).toBe(false)
    })

    it('leaves a block with a broken post alone instead of pointing it at null', () => {
        const e = editor('<div data-telegram-post="tennis_bolshe"><iframe></iframe></div>')

        expect(e.getHTML()).not.toContain('telegram')
    })
})
