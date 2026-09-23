// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'

import { adoptLegacyDraft, NEW, readBuffer, removeBuffer, writeBuffer } from './draftBuffer'

const SUB = 'u1'

describe('the draft buffer', () => {
    beforeEach(() => localStorage.clear())

    it('keeps one entry per person and article', () => {
        const buffer = {
            baseVersion: 'a:1',
            metadata: { type: 'news' as const, title: 'T', slug: '', tags: [] },
            content: '<p>x</p>',
            savedAt: '2026-09-23T10:00:00Z',
        }
        writeBuffer(SUB, 'a1', buffer)

        expect(readBuffer(SUB, 'a1')).toEqual(buffer)
        expect(readBuffer(SUB, 'a2')).toBeNull()
        expect(readBuffer('u2', 'a1')).toBeNull()

        removeBuffer(SUB, 'a1')
        expect(readBuffer(SUB, 'a1')).toBeNull()
    })

    it('forgets an entry it cannot read', () => {
        localStorage.setItem(`editor:${SUB}:a1`, '{not json')

        expect(readBuffer(SUB, 'a1')).toBeNull()
        expect(localStorage.getItem(`editor:${SUB}:a1`)).toBeNull()
    })
})

describe('adoptLegacyDraft', () => {
    beforeEach(() => localStorage.clear())

    it('turns the old single draft into an unsaved new article', () => {
        localStorage.setItem(`editor-content:${SUB}`, '<p>old</p>')
        localStorage.setItem(
            `editor-metadata:${SUB}`,
            JSON.stringify({
                type: 'article',
                title: 'Old',
                slug: '',
                tags: [],
                subtitle: '',
                coverImage: 'data:image/png;base64,AAAA',
            })
        )

        adoptLegacyDraft(SUB)

        const adopted = readBuffer(SUB, NEW)
        expect(adopted?.content).toBe('<p>old</p>')
        expect(adopted?.metadata.title).toBe('Old')
        expect(adopted?.baseVersion).toBeNull()
        // an inline picture is no cover the server can take
        expect(adopted?.metadata.type).toBe('article')
        expect((adopted?.metadata as { coverImage?: string }).coverImage).toBeUndefined()
        expect(localStorage.getItem(`editor-content:${SUB}`)).toBeNull()
        expect(localStorage.getItem(`editor-metadata:${SUB}`)).toBeNull()
    })

    it('does not overwrite an unsaved new article already there', () => {
        writeBuffer(SUB, NEW, {
            baseVersion: null,
            metadata: { type: 'news', title: 'Newer', slug: '', tags: [] },
            content: '',
            savedAt: '2026-09-23T10:00:00Z',
        })
        localStorage.setItem(`editor-content:${SUB}`, '<p>old</p>')

        adoptLegacyDraft(SUB)

        expect(readBuffer(SUB, NEW)?.metadata.title).toBe('Newer')
        expect(localStorage.getItem(`editor-content:${SUB}`)).toBeNull()
    })

    it('drops the keys written before sign-in existed', () => {
        localStorage.setItem('editor-content', '<p>whose?</p>')

        adoptLegacyDraft(SUB)

        expect(localStorage.getItem('editor-content')).toBeNull()
        expect(readBuffer(SUB, NEW)).toBeNull()
    })
})
