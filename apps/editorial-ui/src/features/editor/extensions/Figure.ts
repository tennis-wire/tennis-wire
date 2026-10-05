import type { Editor } from '@tiptap/core'
import Image, { type ImageOptions } from '@tiptap/extension-image'
import type { DOMOutputSpec } from '@tiptap/pm/model'

import { isOwnMedia } from '../lib/media'
import type { CreditKind } from '../types/content'

export interface FigureAttrs {
    src: string
    // the picture's own size in pixels, from the upload; null for one saved before sizes were kept
    width: number | null
    height: number | null
    alt: string | null
    caption: string | null
    credit: string | null
    creditKind: CreditKind
}

export interface FigureStorage {
    // a picture just copied in, whose panel opens by itself so its author gets named
    askCaptionFor: string | null
}

declare module '@tiptap/core' {
    interface Storage {
        image: FigureStorage
    }
}

// Set before the picture goes in: its view opens the panel when it first draws
export function askCaption(editor: Editor, src: string): void {
    editor.storage.image.askCaptionFor = src
}

export function isCaptionAsked(editor: Editor, src: string): boolean {
    return editor.storage.image.askCaptionFor === src
}

// The panel has been shown once: a view drawn again later, after an undo, stays closed
export function captionAnswered(editor: Editor, src: string): void {
    if (isCaptionAsked(editor, src)) editor.storage.image.askCaptionFor = null
}

const KINDS: readonly string[] = ['photo', 'illustration', 'screenshot']

// A bare <img> is read too: articles saved before captions have them
function imageOf(element: HTMLElement): HTMLElement | null {
    return element.tagName === 'IMG' ? element : element.querySelector('img')
}

function sizeOf(element: HTMLElement, name: 'width' | 'height'): number | null {
    const value = Number(imageOf(element)?.getAttribute(name))
    return Number.isInteger(value) && value > 0 ? value : null
}

function textOf(element: HTMLElement, selector: string): string | null {
    return element.querySelector(selector)?.textContent?.trim() || null
}

// A figure from another site has a caption without our parts: all of its text is the caption,
// credit and all, for the author to sort out in the panel
function foreignCaptionOf(element: HTMLElement): string | null {
    const caption = element.querySelector('figcaption')
    if (!caption || caption.querySelector('[data-caption], [data-credit]')) return null
    return caption.textContent?.replace(/\s+/g, ' ').trim() || null
}

// A picture in the article, with an optional caption and credit under it. Written as
// <figure><img><figcaption><span data-caption>...</span><span data-credit="photo">...</span></figcaption></figure>,
// with no figcaption when both are empty. The word before the credit is left to whoever draws it.
export const Figure = Image.extend<ImageOptions, FigureStorage>({
    addStorage() {
        return { askCaptionFor: null }
    },

    addAttributes() {
        return {
            src: {
                default: null,
                parseHTML: (element) => imageOf(element)?.getAttribute('src') ?? null,
                renderHTML: () => ({}),
            },
            width: {
                default: null,
                parseHTML: (element) => sizeOf(element, 'width'),
                renderHTML: () => ({}),
            },
            height: {
                default: null,
                parseHTML: (element) => sizeOf(element, 'height'),
                renderHTML: () => ({}),
            },
            alt: {
                default: null,
                parseHTML: (element) => imageOf(element)?.getAttribute('alt') || null,
                renderHTML: () => ({}),
            },
            caption: {
                default: null,
                parseHTML: (element) =>
                    textOf(element, '[data-caption]') ?? foreignCaptionOf(element),
                renderHTML: () => ({}),
            },
            credit: {
                default: null,
                parseHTML: (element) => textOf(element, '[data-credit]'),
                renderHTML: () => ({}),
            },
            creditKind: {
                default: 'photo',
                parseHTML: (element) => {
                    const kind = element.querySelector('[data-credit]')?.getAttribute('data-credit')
                    return kind && KINDS.includes(kind) ? kind : 'photo'
                },
                renderHTML: () => ({}),
            },
        }
    },

    // Only a picture from the bucket: the site shows no other, and the server takes no other.
    // One from elsewhere, pasted, in an old draft or in the AI chat's markdown, is left out here.
    parseHTML() {
        return [
            {
                tag: 'figure',
                getAttrs: (element) =>
                    isOwnMedia(element.querySelector('img')?.getAttribute('src')) ? null : false,
            },
            {
                tag: 'img',
                getAttrs: (element) => (isOwnMedia(element.getAttribute('src')) ? null : false),
            },
        ]
    },

    renderHTML({ node }) {
        const { src, width, height, alt, caption, credit, creditKind } = node.attrs as FigureAttrs
        const text: DOMOutputSpec[] = []
        if (caption) text.push(['span', { 'data-caption': '' }, caption])
        if (credit) text.push(['span', { 'data-credit': creditKind }, credit])
        return [
            'figure',
            {},
            ['img', { src, alt: alt ?? '', ...(width && height && { width, height }) }],
            ...(text.length > 0 ? [['figcaption', {}, ...text] as DOMOutputSpec] : []),
        ]
    },
})

export default Figure
