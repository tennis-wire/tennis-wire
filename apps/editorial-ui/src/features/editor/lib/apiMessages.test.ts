import { describe, expect, it, vi } from 'vitest'

import { ContentApiError } from '../api/contentApi'
import { messageOf, publishProblem } from './apiMessages'

// the real one pulls in the UserManager, which wants a browser
vi.mock('../../../api/apiFetch', () => ({ apiFetch: vi.fn() }))

describe('messageOf', () => {
    it('explains the codes the editor can run into', () => {
        const stale = new ContentApiError(409, 'STALE_VERSION', 'Saved elsewhere')

        expect(messageOf(stale)).toMatch(/сохранили в другом месте/)
    })

    it('names the missing fields in Russian', () => {
        const error = new ContentApiError(422, 'VALIDATION_FAILED', 'Article cannot be published', [
            { field: 'tags', message: 'At least one tag is required' },
            { field: 'coverImageUrl', message: 'Cover image is required for articles' },
        ])

        expect(messageOf(error)).toBe('Для публикации не хватает: теги, обложка.')
    })

    it('does not blame the server for a network failure', () => {
        expect(messageOf(new TypeError('Failed to fetch'))).toBe('Не удалось связаться с сервером.')
    })
})

describe('publishProblem', () => {
    it('asks an article for its lead and cover', () => {
        const article = {
            type: 'article' as const,
            title: 'T',
            slug: '',
            tags: [{ id: 't', name: 't', slug: 't', type: 'topic' as const }],
            subtitle: '',
        }

        expect(publishProblem(article, '<p>x</p>')).toBe('Заполните подзаголовок для статьи')
    })

    it('lets complete news through', () => {
        const news = {
            type: 'news' as const,
            title: 'T',
            slug: '',
            tags: [{ id: 't', name: 't', slug: 't', type: 'topic' as const }],
        }

        expect(publishProblem(news, '<p>x</p>')).toBeNull()
    })
})
