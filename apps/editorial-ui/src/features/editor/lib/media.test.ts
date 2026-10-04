// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import { MEDIA_BASE_URL, isOwnMedia, stripForeignMedia } from './media'

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
