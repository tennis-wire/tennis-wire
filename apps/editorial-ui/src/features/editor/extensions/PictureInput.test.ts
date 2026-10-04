// @vitest-environment jsdom
import { Editor } from '@tiptap/core'
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import { Slice } from '@tiptap/pm/model'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MEDIA_BASE_URL } from '../lib/media'
import { Figure } from './Figure'
import { PictureInput } from './PictureInput'

const picture = (name: string) => new File(['x'], name, { type: 'image/png' })

function setUp(upload = (file: File) => Promise.resolve(`${MEDIA_BASE_URL}2026/10/${file.name}`)) {
    const notify = vi.fn()
    const editor = new Editor({
        extensions: [
            Document,
            Paragraph,
            Text,
            Figure,
            PictureInput.configure({ upload, errorMessage: () => 'Файл больше 10 МБ', notify }),
        ],
        content: '<p>Text</p>',
    })
    return { editor, notify }
}

function paste(editor: Editor, files: File[]): boolean {
    const event = { clipboardData: { files } } as unknown as ClipboardEvent
    return editor.view.someProp('handlePaste', (f) => f(editor.view, event, Slice.empty)) ?? false
}

function drop(editor: Editor, files: File[]): boolean {
    const event = { dataTransfer: { files }, clientX: 10, clientY: 10 } as unknown as DragEvent
    return (
        editor.view.someProp('handleDrop', (f) => f(editor.view, event, Slice.empty, false)) ??
        false
    )
}

// jsdom lays nothing out: a drop finds no place under the pointer and falls back to the cursor
beforeEach(() => {
    document.elementFromPoint = () => null
})

afterEach(() => {
    vi.restoreAllMocks()
})

describe('PictureInput', () => {
    it('uploads a pasted picture and puts it in the text', async () => {
        const { editor } = setUp()

        expect(paste(editor, [picture('a.png')])).toBe(true)

        await vi.waitFor(() =>
            expect(editor.getHTML()).toContain(`<img src="${MEDIA_BASE_URL}2026/10/a.png"`)
        )
    })

    it('leaves a paste without pictures to the editor', () => {
        const { editor } = setUp()

        expect(paste(editor, [])).toBe(false)
        expect(paste(editor, [new File(['x'], 'a.txt', { type: 'text/plain' })])).toBe(false)
    })

    it('uploads dropped pictures, in order, and refuses other files', async () => {
        const { editor, notify } = setUp()

        expect(drop(editor, [picture('a.png'), picture('b.png')])).toBe(true)
        await vi.waitFor(() => expect(editor.getHTML()).toMatch(/a\.png[\s\S]*b\.png/))

        expect(drop(editor, [new File(['x'], 'a.pdf', { type: 'application/pdf' })])).toBe(true)
        expect(notify).toHaveBeenCalledWith('Можно перетаскивать только изображения', 'warning')
    })

    it('says what failed and how many got in', async () => {
        const { editor, notify } = setUp((file) =>
            file.name === 'big.png'
                ? Promise.reject(new Error('too large'))
                : Promise.resolve(`${MEDIA_BASE_URL}2026/10/${file.name}`)
        )

        paste(editor, [picture('a.png'), picture('big.png')])

        await vi.waitFor(() =>
            expect(notify).toHaveBeenCalledWith('Файл больше 10 МБ. Добавлено: 1 из 2', 'error')
        )
        expect(editor.getHTML()).toContain('a.png')
    })

    it('tells the author when pictures from elsewhere are left out of a paste', () => {
        const { editor, notify } = setUp()
        // as ProseMirror does it: every plugin's transform, one after another
        const transform = (html: string) => {
            let out = html
            editor.view.someProp('transformPastedHTML', (f) => {
                out = f(out, editor.view)
            })
            return out
        }

        expect(transform('<p>a</p><img src="https://www.atptour.com/a.jpg">')).toBe('<p>a</p>')
        expect(notify).toHaveBeenCalledWith(expect.stringMatching(/с других сайтов/), 'warning')
    })
})
