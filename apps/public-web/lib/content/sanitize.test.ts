import { describe, expect, it } from 'vitest'

import { sanitizeArticle } from './sanitize'

describe('sanitizeArticle', () => {
    it('keeps what the editor writes', () => {
        const html =
            '<h2>Title</h2><p>Text with <strong>bold</strong> and <a href="https://example.com/x">a link</a>.</p>' +
            '<ul><li>one</li></ul><img src="https://cdn.example.com/a.jpg" alt="court">'
        expect(sanitizeArticle(html)).toBe(
            '<h2>Title</h2><p>Text with <strong>bold</strong> and <a href="https://example.com/x">a link</a>.</p>' +
                '<ul><li>one</li></ul><img src="https://cdn.example.com/a.jpg" alt="court" />'
        )
    })

    it('drops scripts, handlers and javascript: links', () => {
        const html =
            '<p onclick="steal()">hi</p><script>steal()</script>' +
            '<a href="javascript:steal()">x</a><img src="x" onerror="steal()">'
        expect(sanitizeArticle(html)).toBe('<p>hi</p><a>x</a><img src="x" />')
    })

    it('keeps the embeds the editor makes and no other frame', () => {
        const youtube =
            '<div data-youtube-video><iframe src="https://www.youtube-nocookie.com/embed/abc" allowfullscreen></iframe></div>'
        const telegram =
            '<div data-telegram-post="chan/1" class="telegram-embed">' +
            '<iframe src="https://t.me/chan/1?embed=1" style="border: none"></iframe></div>'
        const foreign = '<iframe src="https://evil.example.com/"></iframe>'

        expect(sanitizeArticle(youtube)).toBe(youtube)
        expect(sanitizeArticle(telegram)).toBe(
            '<div data-telegram-post="chan/1" class="telegram-embed">' +
                '<iframe src="https://t.me/chan/1?embed=1"></iframe></div>'
        )
        expect(sanitizeArticle(foreign)).toBe('')
    })

    it('drops a picture that was never uploaded', () => {
        const inline = '<p>a</p><img src="data:image/png;base64,AAAA"><p>b</p>'
        expect(sanitizeArticle(inline)).toBe('<p>a</p><p>b</p>')
    })
})
