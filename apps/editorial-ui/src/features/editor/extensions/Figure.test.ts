// @vitest-environment jsdom
import { Editor } from '@tiptap/core'
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import { describe, expect, it } from 'vitest'

import { MEDIA_BASE_URL } from '../lib/media'
import { Figure } from './Figure'

function editor(content?: string): Editor {
    return new Editor({ extensions: [Document, Paragraph, Text, Figure], content })
}

const SRC = `${MEDIA_BASE_URL}2026/09/court.jpg`

describe('Figure node', () => {
    it('writes a picture with no text as a figure with no caption under it', () => {
        const e = editor()
        e.commands.setImage({ src: SRC })

        expect(e.getHTML()).toBe(`<figure><img src="${SRC}" alt=""></figure>`)
    })

    it('reads its own caption and credit back', () => {
        const html =
            `<figure><img src="${SRC}" alt="An empty court"><figcaption>` +
            '<span data-caption="">Centre court</span>' +
            '<span data-credit="illustration">Andrewc013 / CC BY-SA 4.0</span>' +
            '</figcaption></figure>'

        const e = editor(html)

        expect(e.getJSON().content?.[0]).toEqual({
            type: 'image',
            attrs: {
                src: SRC,
                width: null,
                height: null,
                alt: 'An empty court',
                caption: 'Centre court',
                credit: 'Andrewc013 / CC BY-SA 4.0',
                creditKind: 'illustration',
            },
        })
        expect(e.getHTML()).toBe(html)
    })

    it('writes a credit without a caption, and nothing where there is none', () => {
        const e = editor()
        e.commands.setImage({ src: SRC })
        e.commands.updateAttributes('image', { credit: 'Getty Images' })

        expect(e.getHTML()).toBe(
            `<figure><img src="${SRC}" alt=""><figcaption>` +
                '<span data-credit="photo">Getty Images</span></figcaption></figure>'
        )
    })

    it('takes a bare picture from an article saved before captions', () => {
        const e = editor(`<p>Before</p><img src="${SRC}"><p>After</p>`)

        expect(e.getHTML()).toBe(
            `<p>Before</p><figure><img src="${SRC}" alt=""></figure><p>After</p>`
        )
    })

    it('reads an unknown credit kind as a photo', () => {
        const e = editor(
            `<figure><img src="${SRC}"><figcaption><span data-credit="drawing">X</span></figcaption></figure>`
        )

        expect(e.getJSON().content?.[0]?.attrs?.creditKind).toBe('photo')
    })

    it('leaves out a picture pasted as data', () => {
        expect(
            editor('<figure><img src="data:image/png;base64,AAAA"></figure>').getHTML()
        ).not.toContain('img')
    })

    it('leaves out a picture from anywhere but the bucket, caption and all', () => {
        const e = editor(
            '<p>a</p><figure><img src="https://elsewhere.example/a.jpg"></figure>' +
                '<img src="https://elsewhere.example/b.jpg"><p>b</p>'
        )

        expect(e.getHTML()).toBe('<p>a</p><p>b</p>')
    })

    it('takes the caption of a figure from another site as it stands', () => {
        const e = editor(
            `<figure><img src="${SRC}"><figcaption>Centre court.\n  Photo: Getty</figcaption></figure>`
        )

        expect(e.getJSON().content?.[0]?.attrs).toMatchObject({
            caption: 'Centre court. Photo: Getty',
            credit: null,
        })
    })

    it('keeps the size of a picture, and no size it cannot trust', () => {
        const sized = editor(`<figure><img src="${SRC}" width="1200" height="800"></figure>`)
        const junk = editor(`<img src="${SRC}" width="abc" height="-5">`)

        expect(sized.getHTML()).toBe(
            `<figure><img src="${SRC}" alt="" width="1200" height="800"></figure>`
        )
        expect(junk.getHTML()).toBe(`<figure><img src="${SRC}" alt=""></figure>`)
    })
})
