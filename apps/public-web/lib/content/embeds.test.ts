import { describe, expect, it } from 'vitest'

import { embedTitle } from './embeds'

describe('embedTitle', () => {
    it('names a frame by where it comes from', () => {
        expect(embedTitle('https://www.youtube-nocookie.com/embed/abc')).toBe('Видео YouTube')
        expect(embedTitle('https://www.youtube.com/embed/abc')).toBe('Видео YouTube')
        expect(embedTitle('https://t.me/chan/1?embed=1')).toBe('Пост в Telegram')
        expect(embedTitle('https://evilyoutube.com/embed/abc')).toBe('Встроенный материал')
        expect(embedTitle(undefined)).toBe('Встроенный материал')
    })
})
