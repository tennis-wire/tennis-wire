import { describe, expect, it } from 'vitest'

import { createRequestOf, metadataOf, saveRequestOf, snapshotOf } from './articleForm'
import type { ContentMetadata, EditorialArticle } from '../types/content'

const tag = (id: string) => ({ id, name: id, slug: id, type: 'topic' as const })

function article(overrides: Partial<EditorialArticle> = {}): EditorialArticle {
    return {
        id: 'a1',
        type: 'article',
        status: 'draft',
        slug: null,
        version: 'a:3',
        working: {
            title: 'Title',
            subtitle: 'Lead',
            content: '<p>Body</p>',
            coverImageUrl: 'http://media/cover.png',
            readingTime: 1,
            sourceUrl: null,
            sourceName: null,
            tags: [tag('b'), tag('a')],
        },
        live: null,
        lockedBy: null,
        aggregatorItemId: null,
        publishedAt: null,
        firstPublishedAt: null,
        updatedAt: '2026-09-23T10:00:00Z',
        createdAt: '2026-09-23T10:00:00Z',
        ...overrides,
    }
}

describe('metadataOf and the requests', () => {
    it('round-trips an article unchanged', () => {
        const loaded = article()
        const request = saveRequestOf(loaded.version, metadataOf(loaded), '<p>Body</p>')

        expect(request).toEqual({
            version: 'a:3',
            type: 'article',
            title: 'Title',
            subtitle: 'Lead',
            slug: null,
            content: '<p>Body</p>',
            coverImageUrl: 'http://media/cover.png',
            sourceUrl: null,
            sourceName: null,
            tagIds: ['b', 'a'],
        })
    })

    // the server takes null as "clear this", so an emptied field must go as null
    it('sends a blank optional field as null', () => {
        const metadata: ContentMetadata = {
            type: 'news',
            title: 'Title',
            slug: '   ',
            tags: [],
            sourceUrl: '',
            sourceName: ' ',
        }

        expect(createRequestOf(metadata, '')).toMatchObject({
            slug: null,
            sourceUrl: null,
            sourceName: null,
            subtitle: null,
            coverImageUrl: null,
        })
    })

    it('drops what news do not have', () => {
        const metadata = { ...metadataOf(article()), type: 'news' } as ContentMetadata

        expect(createRequestOf(metadata, '')).toMatchObject({ subtitle: null, coverImageUrl: null })
    })
})

describe('snapshotOf', () => {
    it('does not care about the order of tags', () => {
        const loaded = metadataOf(article())
        const reordered = { ...loaded, tags: [...loaded.tags].reverse() }

        expect(snapshotOf(reordered, 'x')).toBe(snapshotOf(loaded, 'x'))
    })

    it('sees an edit of the text or of a field', () => {
        const loaded = metadataOf(article())

        expect(snapshotOf(loaded, '<p>Other</p>')).not.toBe(snapshotOf(loaded, '<p>Body</p>'))
        expect(snapshotOf({ ...loaded, title: 'New' }, 'x')).not.toBe(snapshotOf(loaded, 'x'))
    })

    // what the server stores comes back without the padding
    it('ignores surrounding blanks the server would trim away', () => {
        const loaded = metadataOf(article())

        expect(snapshotOf({ ...loaded, title: ' Title ' }, 'x')).toBe(snapshotOf(loaded, 'x'))
    })
})
