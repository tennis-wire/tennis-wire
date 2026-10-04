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

const ours = (name: string) => `${MEDIA_BASE_URL}2026/10/${name}`

function setUp(
    upload = (file: File) => Promise.resolve(ours(file.name)),
    copy = (link: string) => Promise.resolve(ours(link.split('/').pop() ?? 'x'))
) {
    const notify = vi.fn()
    const copyMock = vi.fn(copy)
    const editor = new Editor({
        extensions: [
            Document,
            Paragraph,
            Text,
            Figure,
            PictureInput.configure({
                upload,
                copy: copyMock,
                errorMessage: () => 'Файл больше 10 МБ',
                notify,
            }),
        ],
        content: '<p>Text</p>',
    })
    return { editor, notify, copy: copyMock }
}

function paste(editor: Editor, files: File[], html = ''): boolean {
    const clipboardData = { files, getData: (type: string) => (type === 'text/html' ? html : '') }
    const event = { clipboardData } as unknown as ClipboardEvent
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

    it('leaves pictures from elsewhere out of what is pasted', () => {
        const { editor } = setUp()
        // as ProseMirror does it: every plugin's transform, one after another
        let html = '<p>a</p><img src="https://www.atptour.com/a.jpg">'
        editor.view.someProp('transformPastedHTML', (f) => {
            html = f(html, editor.view)
        })

        expect(html).toBe('<p>a</p>')
    })

    it('asks before copying pictures from elsewhere, and pastes the copies', async () => {
        const { editor, copy } = setUp()
        const ask = vi.fn(() => Promise.resolve(true))
        editor.storage.pictureInput.setCopyQuestion(ask)

        const html = '<p>Pasted</p><img src="https://www.atptour.com/a.jpg">'
        expect(paste(editor, [], html)).toBe(true)

        await vi.waitFor(() => expect(editor.getHTML()).toContain(ours('a.jpg')))
        expect(ask).toHaveBeenCalledWith(1)
        expect(copy).toHaveBeenCalledWith('https://www.atptour.com/a.jpg')
        expect(editor.getHTML()).toContain('Pasted')
        // the one copy opens its caption panel when it draws
        expect(editor.storage.image.askCaptionFor).toBe(ours('a.jpg'))
    })

    it('pastes the text alone when told not to copy, and nothing when the paste is cancelled', async () => {
        const html = '<p>Pasted</p><img src="https://www.atptour.com/a.jpg">'

        const without = setUp()
        without.editor.storage.pictureInput.setCopyQuestion(() => Promise.resolve(false))
        paste(without.editor, [], html)
        await vi.waitFor(() => expect(without.editor.getHTML()).toContain('Pasted'))
        expect(without.editor.getHTML()).not.toContain('img')
        expect(without.copy).not.toHaveBeenCalled()

        const cancelled = setUp()
        cancelled.editor.storage.pictureInput.setCopyQuestion(() => Promise.resolve(null))
        paste(cancelled.editor, [], html)
        await new Promise((resolve) => setTimeout(resolve, 0))
        expect(cancelled.editor.getHTML()).toBe('<p>Text</p>')
    })

    it('pastes what it could copy and says what it could not', async () => {
        const { editor, notify } = setUp(undefined, (link) =>
            link.endsWith('b.jpg')
                ? Promise.reject(new Error('refused'))
                : Promise.resolve(ours('a.jpg'))
        )
        editor.storage.pictureInput.setCopyQuestion(() => Promise.resolve(true))

        paste(editor, [], '<img src="https://x.example/a.jpg"><img src="https://x.example/b.jpg">')

        await vi.waitFor(() =>
            expect(notify).toHaveBeenCalledWith(
                expect.stringMatching(/Не скопировано картинок: 1 из 2/),
                'warning'
            )
        )
        expect(editor.getHTML()).toContain(ours('a.jpg'))
        expect(editor.getHTML()).not.toContain('b.jpg')
    })

    it('says so when the pictures from elsewhere cannot be copied at all', () => {
        const { editor, notify } = setUp()

        expect(paste(editor, [], '<p>a</p><img src="data:image/png;base64,AAAA">')).toBe(false)
        expect(notify).toHaveBeenCalledWith(expect.stringMatching(/с других сайтов/), 'warning')
    })
})
