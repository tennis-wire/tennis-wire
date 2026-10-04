import Image from '@tiptap/extension-image'
import type { DOMOutputSpec } from '@tiptap/pm/model'

import { isOwnMedia } from '../lib/media'
import type { CreditKind } from '../types/content'

export interface FigureAttrs {
    src: string
    alt: string | null
    caption: string | null
    credit: string | null
    creditKind: CreditKind
}

const KINDS: readonly string[] = ['photo', 'illustration', 'screenshot']

// A bare <img> is read too: articles saved before captions have them
function imageOf(element: HTMLElement): HTMLElement | null {
    return element.tagName === 'IMG' ? element : element.querySelector('img')
}

function textOf(element: HTMLElement, selector: string): string | null {
    return element.querySelector(selector)?.textContent?.trim() || null
}

// A picture in the article, with an optional caption and credit under it. Written as
// <figure><img><figcaption><span data-caption>...</span><span data-credit="photo">...</span></figcaption></figure>,
// with no figcaption when both are empty. The word before the credit is left to whoever draws it.
export const Figure = Image.extend({
    addAttributes() {
        return {
            src: {
                default: null,
                parseHTML: (element) => imageOf(element)?.getAttribute('src') ?? null,
                renderHTML: () => ({}),
            },
            alt: {
                default: null,
                parseHTML: (element) => imageOf(element)?.getAttribute('alt') || null,
                renderHTML: () => ({}),
            },
            caption: {
                default: null,
                parseHTML: (element) => textOf(element, '[data-caption]'),
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
        const { src, alt, caption, credit, creditKind } = node.attrs as FigureAttrs
        const text: DOMOutputSpec[] = []
        if (caption) text.push(['span', { 'data-caption': '' }, caption])
        if (credit) text.push(['span', { 'data-credit': creditKind }, credit])
        return [
            'figure',
            {},
            ['img', { src, alt: alt ?? '' }],
            ...(text.length > 0 ? [['figcaption', {}, ...text] as DOMOutputSpec] : []),
        ]
    },
})

export default Figure
