// What to tell a person when the content service says no

import { ContentApiError } from '../api/contentApi'
import type { ContentMetadata } from '../types/content'

const FIELDS: Record<string, string> = {
    title: 'заголовок',
    subtitle: 'подзаголовок',
    content: 'текст',
    tags: 'теги',
    tagIds: 'теги',
    coverImageUrl: 'обложка',
    slug: 'адрес (slug)',
    sourceUrl: 'URL источника',
    sourceName: 'название издания',
}

const BY_CODE: Record<string, string> = {
    STALE_VERSION:
        'Материал уже сохранили в другом месте. Обновите страницу: ваши изменения будет предложено восстановить.',
    LOCKED: 'Материал сейчас правит другой сотрудник.',
    FROZEN: 'Тип и адрес материала, который уже был на сайте, не меняются.',
    SLUG_TAKEN: 'Такой адрес уже занят другим материалом.',
    UNKNOWN_TAG: 'Одного из тегов больше нет. Уберите его и сохраните снова.',
    NO_PENDING_EDIT: 'Неопубликованных правок нет.',
    WAS_PUBLISHED: 'Материал уже был на сайте, поэтому не удаляется.',
    FORBIDDEN: 'Этот материал может править только его автор или главный редактор.',
    NOT_FOUND: 'Материал не найден.',
}

function fieldsOf(violations: { field: string }[]): string {
    const names = violations.map((v) => FIELDS[v.field] ?? v.field)
    return [...new Set(names)].join(', ')
}

export function messageOf(error: unknown): string {
    if (!(error instanceof ContentApiError)) return 'Не удалось связаться с сервером.'
    const known = BY_CODE[error.errorCode]
    if (known) return known
    if (error.violations?.length) {
        return error.errorCode === 'VALIDATION_FAILED'
            ? `Для публикации не хватает: ${fieldsOf(error.violations)}.`
            : `Проверьте: ${fieldsOf(error.violations)}.`
    }
    return error.message
}

// Checked before anything is sent; the server checks the same again
export function publishProblem(metadata: ContentMetadata, html: string): string | null {
    if (!metadata.title.trim()) return 'Заполните заголовок'
    if (metadata.tags.length === 0) return 'Добавьте хотя бы один тег'
    if (metadata.type === 'article') {
        if (!metadata.subtitle?.trim()) return 'Заполните подзаголовок для статьи'
        if (!metadata.coverImage) return 'Загрузите обложку для статьи'
    }
    if (!html) return 'Текст материала не может быть пустым'
    return null
}
