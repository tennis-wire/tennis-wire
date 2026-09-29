import { describe, expect, it } from 'vitest'

import { labelCredits } from './credits'

describe('labelCredits', () => {
    it('puts the word for its kind before every credit', () => {
        expect(
            labelCredits(
                '<span data-caption="">Court</span><span data-credit="photo">Getty</span>' +
                    '<span data-credit="screenshot">ATP TV</span>'
            )
        ).toBe(
            '<span data-caption="">Court</span><span data-credit="photo">Фото: Getty</span>' +
                '<span data-credit="screenshot">Скриншот: ATP TV</span>'
        )
    })

    it('leaves the rest of the text alone', () => {
        const html = '<p>data-credit="photo"</p><span>Getty</span>'

        expect(labelCredits(html)).toBe(html)
    })
})
