import { describe, expect, it } from 'vitest'

import { splitPolls } from './polls'

const poll = (id: string) =>
    `<div data-poll="${id}" class="poll-embed"><p>Q</p><ol><li>A</li></ol></div>`

describe('splitPolls', () => {
    it('leaves an article without polls as it is', () => {
        expect(splitPolls('<p>a</p><p>b</p>')).toEqual([{ html: '<p>a</p><p>b</p>' }])
        expect(splitPolls('')).toEqual([{ html: '' }])
    })

    it('cuts the article around each poll and keeps the block for the fallback', () => {
        expect(splitPolls(`<p>a</p>${poll('p1')}<p>b</p>${poll('p2')}`)).toEqual([
            { html: '<p>a</p>' },
            { pollId: 'p1', fallback: poll('p1') },
            { html: '<p>b</p>' },
            { pollId: 'p2', fallback: poll('p2') },
        ])
    })

    it('stops at the end of the block and not at a later div', () => {
        const html = `${poll('p1')}<div data-video class="video-embed"><video src="https://x/v.mp4"></video></div>`
        const pieces = splitPolls(html)
        expect(pieces).toHaveLength(2)
        expect(pieces[0]).toEqual({ pollId: 'p1', fallback: poll('p1') })
    })
})
