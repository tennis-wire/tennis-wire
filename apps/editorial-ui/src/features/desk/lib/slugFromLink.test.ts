import { describe, expect, it } from 'vitest'

import { slugFromLink } from './slugFromLink'

describe('slugFromLink', () => {
    it.each([
        ['https://tennis-wire.ru/news/sinner-wins', 'sinner-wins'],
        ['https://tennis-wire.ru/materials/long-read-2026/?utm=x#top', 'long-read-2026'],
        ['tennis-wire.ru/news/sinner-wins?ref=tg', 'sinner-wins'],
        ['/news/sinner-wins', 'sinner-wins'],
        ['  sinner-wins  ', 'sinner-wins'],
    ])('finds the slug in %s', (input, slug) => {
        expect(slugFromLink(input)).toBe(slug)
    })

    it.each([
        '',
        '   ',
        'https://tennis-wire.ru/',
        'Синнер выиграл',
        'https://x.ru/news/Not_A_Slug',
    ])('finds none in %j', (input) => {
        expect(slugFromLink(input)).toBeNull()
    })
})
