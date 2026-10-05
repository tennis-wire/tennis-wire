// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import {
    MEDIA_BASE_URL,
    foreignPictureLinks,
    isOwnMedia,
    stripForeignMedia,
    withCopies,
} from './media'

const OURS = `${MEDIA_BASE_URL}2026/10/a.jpg`

describe('isOwnMedia', () => {
    it('knows the bucket from anywhere else', () => {
        expect(isOwnMedia(OURS)).toBe(true)
        expect(isOwnMedia('https://www.atptour.com/a.jpg')).toBe(false)
        expect(isOwnMedia(`${MEDIA_BASE_URL.replace(/\/$/, '')}.evil.example/a.jpg`)).toBe(false)
        expect(isOwnMedia(null)).toBe(false)
    })
})

describe('stripForeignMedia', () => {
    it('takes out pictures from elsewhere with their figure, and keeps the text', () => {
        const html =
            '<p>Text</p><figure><img src="https://www.atptour.com/a.jpg"><figcaption>Theirs</figcaption></figure>' +
            '<p>More <img src="https://elsewhere.example/b.png"></p>' +
            '<video><source src="https://elsewhere.example/c.mp4"></video>'

        expect(stripForeignMedia(html)).toEqual({ html: '<p>Text</p><p>More </p>', dropped: 3 })
    })

    it('keeps a picture from the bucket', () => {
        const kept = stripForeignMedia(
            `<p>a</p><img src="${OURS}"><img src="https://x.example/b.png">`
        )

        expect(kept).toEqual({ html: `<p>a</p><img src="${OURS}">`, dropped: 1 })
    })

    it('hands back the very same html when there is nothing to take out', () => {
        const html = '<meta charset="utf-8"><p data-pm-slice="1 1 []">Copied here</p>'

        expect(stripForeignMedia(html)).toEqual({ html, dropped: 0 })
    })
})

describe('foreignPictureLinks', () => {
    it('finds where each picture from elsewhere really is, once', () => {
        const html =
            '<img src="https://www.atptour.com/a.jpg">' +
            '<img src="data:image/gif;base64,R0lGOD" data-src="https://lazy.example/b.jpg">' +
            '<img src="data:image/gif;base64,R0lGOD" srcset="https://x.example/c-400.jpg 400w, https://x.example/c-1200.jpg 1200w">' +
            '<img src="https://www.atptour.com/a.jpg">' +
            `<img src="${OURS}">` +
            '<img src="data:image/png;base64,AAAA">'

        expect(foreignPictureLinks(html)).toEqual([
            'https://www.atptour.com/a.jpg',
            'https://lazy.example/b.jpg',
            'https://x.example/c-1200.jpg',
        ])
    })
})

describe('withCopies', () => {
    it('puts each copy where its picture was, with the size of the copy', () => {
        const html =
            '<p>a</p><img src="data:x" data-src="https://lazy.example/b.jpg" srcset="y 1x" width="300">'
        const copy = { src: OURS, width: 1200, height: 800 }

        expect(withCopies(html, new Map([['https://lazy.example/b.jpg', copy]]))).toBe(
            `<p>a</p><img src="${OURS}" width="1200" height="800">`
        )
    })
})
