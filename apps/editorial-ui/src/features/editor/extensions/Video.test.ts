// @vitest-environment jsdom
import { Editor } from '@tiptap/core'
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import { describe, expect, it } from 'vitest'

import { Video } from './Video'

function editor(content?: string): Editor {
    return new Editor({ extensions: [Document, Paragraph, Text, Video], content })
}

const SRC = 'https://media.example.com/2026/09/v.mp4'

describe('Video node', () => {
    it('reads its own output back, so saving a reopened article keeps the video', () => {
        const e = editor()
        e.commands.setVideo({ src: SRC })

        const reread = editor(e.getHTML())

        expect(reread.getJSON().content?.[0]).toEqual({ type: 'video', attrs: { src: SRC } })
        expect(reread.getHTML()).toBe(e.getHTML())
    })

    it('takes the address of a bare video', () => {
        const e = editor(`<video src="${SRC}"></video>`)

        expect(e.getJSON().content?.[0]).toEqual({ type: 'video', attrs: { src: SRC } })
    })
})
