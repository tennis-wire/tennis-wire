// What the editor holds but the server does not have yet, kept in localStorage so a
// crash or a closed tab does not take it. Not the draft itself: that lives on the
// server. One entry per person and article, new articles under "new".

import type { ContentMetadata } from '../types/content'

export interface DraftBuffer {
    // The version of the working copy this was typed over; null for a new article
    baseVersion: string | null
    metadata: ContentMetadata
    content: string
    savedAt: string
}

export const NEW = 'new'

// Written before the editor knew who was using it. Dropped rather than migrated:
// guessing whose draft it was is worse than losing one.
const UNOWNED_KEYS = ['editor-content', 'editor-metadata']

function keyOf(sub: string, articleId: string): string {
    return `editor:${sub}:${articleId}`
}

// Drafts saved before covers were uploaded hold the picture itself as a data: URL,
// which the server has no room for. The cover is asked for again instead.
function withoutInlineCover(metadata: ContentMetadata): ContentMetadata {
    if (metadata.type !== 'article' || !metadata.coverImage?.startsWith('data:')) return metadata
    return { ...metadata, coverImage: undefined }
}

export function readBuffer(sub: string, articleId: string): DraftBuffer | null {
    const saved = localStorage.getItem(keyOf(sub, articleId))
    if (!saved) return null
    try {
        const buffer = JSON.parse(saved) as DraftBuffer
        return { ...buffer, metadata: withoutInlineCover(buffer.metadata) }
    } catch {
        localStorage.removeItem(keyOf(sub, articleId))
        return null
    }
}

export function writeBuffer(sub: string, articleId: string, buffer: DraftBuffer): void {
    localStorage.setItem(keyOf(sub, articleId), JSON.stringify(buffer))
}

export function removeBuffer(sub: string, articleId: string): void {
    localStorage.removeItem(keyOf(sub, articleId))
}

// Before drafts lived on the server there was one per person, never saved anywhere
// else. It becomes that person's unsaved new article, unless one is there already.
export function adoptLegacyDraft(sub: string): void {
    for (const key of UNOWNED_KEYS) localStorage.removeItem(key)

    const contentKey = `editor-content:${sub}`
    const metadataKey = `editor-metadata:${sub}`
    const content = localStorage.getItem(contentKey)
    const metadata = localStorage.getItem(metadataKey)
    localStorage.removeItem(contentKey)
    localStorage.removeItem(metadataKey)

    if ((content === null && metadata === null) || localStorage.getItem(keyOf(sub, NEW))) return
    let parsed: ContentMetadata | null
    try {
        parsed = metadata === null ? null : (JSON.parse(metadata) as ContentMetadata)
    } catch {
        parsed = null
    }
    if (parsed === null && !content) return
    writeBuffer(sub, NEW, {
        baseVersion: null,
        metadata: withoutInlineCover(parsed ?? { title: '', slug: '', tags: [], type: 'news' }),
        content: content ?? '',
        savedAt: new Date().toISOString(),
    })
}
