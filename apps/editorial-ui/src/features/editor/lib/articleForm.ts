// Between what the server keeps and what the form edits

import type {
    ContentMetadata,
    CreateArticleRequest,
    EditorialArticle,
    SaveArticleRequest,
} from '../types/content'

export function metadataOf(article: EditorialArticle): ContentMetadata {
    const { working } = article
    const common = {
        title: working.title,
        slug: article.slug ?? '',
        tags: working.tags,
        sourceUrl: working.sourceUrl ?? '',
        sourceName: working.sourceName ?? '',
    }
    return article.type === 'article'
        ? {
              ...common,
              type: 'article',
              subtitle: working.subtitle ?? '',
              coverImage: working.coverImageUrl ?? undefined,
          }
        : { ...common, type: 'news' }
}

function orNull(value: string | undefined): string | null {
    const trimmed = value?.trim()
    return trimmed ? trimmed : null
}

// Blank optional fields go as null: the server clears whatever is sent as null
function fieldsOf(metadata: ContentMetadata, content: string) {
    const article = metadata.type === 'article' ? metadata : null
    return {
        type: metadata.type,
        title: metadata.title.trim(),
        subtitle: orNull(article?.subtitle),
        slug: orNull(metadata.slug),
        content,
        coverImageUrl: orNull(article?.coverImage),
        sourceUrl: orNull(metadata.sourceUrl),
        sourceName: orNull(metadata.sourceName),
        tagIds: metadata.tags.map((tag) => tag.id),
    }
}

export function createRequestOf(metadata: ContentMetadata, content: string): CreateArticleRequest {
    return fieldsOf(metadata, content)
}

export function saveRequestOf(
    version: string,
    metadata: ContentMetadata,
    content: string
): SaveArticleRequest {
    return { version, ...fieldsOf(metadata, content) }
}

// Equal snapshots mean a save would change nothing. Built from the request itself, so
// what counts as a change is exactly what the server would receive; tag order is not.
export function snapshotOf(metadata: ContentMetadata, content: string): string {
    const fields = fieldsOf(metadata, content)
    return JSON.stringify({ ...fields, tagIds: [...fields.tagIds].sort() })
}
