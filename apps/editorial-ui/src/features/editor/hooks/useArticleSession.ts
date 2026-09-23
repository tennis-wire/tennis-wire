import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { articlesApi, ContentApiError } from '../api/contentApi'
import { createRequestOf, metadataOf, saveRequestOf, snapshotOf } from '../lib/articleForm'
import { messageOf, publishProblem } from '../lib/apiMessages'
import { timeOf } from '../lib/dates'
import {
    adoptLegacyDraft,
    NEW,
    readBuffer,
    removeBuffer,
    writeBuffer,
    type DraftBuffer,
} from '../lib/draftBuffer'
import type { ContentMetadata, EditorialArticle } from '../types/content'
import { defaultArticleMetadata, defaultNewsMetadata } from '../types/content'
import { htmlOf, useArticleEditor } from './useArticleEditor'

export type LoadState = 'loading' | 'ready' | 'missing' | 'forbidden' | 'failed'
// locked: someone else holds a pending edit, and the article is read-only here
export type Mode = 'new' | 'draft' | 'published' | 'locked'
export type Busy = 'save' | 'publish' | 'discard' | 'delete' | 'unpublish' | null

type Severity = 'success' | 'error' | 'warning' | 'info'

interface Params {
    // null for an article that has not been saved yet
    articleId: string | null
    // what the route is keyed by; a new article keeps it when it moves to its own address
    sessionKey: string
    sub: string
    showSnackbar: (message: string, severity: Severity) => void
}

const BLANK = snapshotOf(defaultNewsMetadata, '')

function loadStateOf(error: unknown): LoadState {
    if (error instanceof ContentApiError) {
        // an id that is not a uuid answers 400; for the person it is just not there
        if (error.status === 404 || error.status === 400) return 'missing'
        if (error.status === 403) return 'forbidden'
    }
    return 'failed'
}

// One article open in the editor: what the server has, what the form holds, and the
// way between them. The server is the source of truth; localStorage only keeps what
// has not reached it yet.
export function useArticleSession({ articleId, sessionKey, sub, showSnackbar }: Params) {
    const navigate = useNavigate()

    // A new article may pick up where an unsaved one was left
    const [pending] = useState<DraftBuffer | null>(() => {
        if (articleId !== null) return null
        adoptLegacyDraft(sub)
        return readBuffer(sub, NEW)
    })

    const [article, setArticle] = useState<EditorialArticle | null>(null)
    const [loadState, setLoadState] = useState<LoadState>(articleId === null ? 'ready' : 'loading')
    const [metadata, setMetadata] = useState<ContentMetadata>(
        () => pending?.metadata ?? defaultNewsMetadata
    )
    // The editor's html, mirrored so that a keystroke re-renders what depends on it
    const [content, setContent] = useState('')
    // What the server holds, in snapshot form; the form is dirty while it differs
    const [baseline, setBaseline] = useState(BLANK)
    const [busy, setBusy] = useState<Busy>(null)

    const editor = useArticleEditor(setContent)

    // For callbacks that must see the latest values without being rebuilt on each keystroke
    const articleRef = useRef<EditorialArticle | null>(null)
    const busyRef = useRef(false)
    const dirtyRef = useRef(false)
    const leavingRef = useRef(false)
    const restoredRef = useRef(false)

    const dirty = loadState === 'ready' && snapshotOf(metadata, content) !== baseline
    const mode: Mode =
        article === null
            ? 'new'
            : article.lockedBy !== null
              ? 'locked'
              : article.status === 'draft'
                ? 'draft'
                : 'published'

    useEffect(() => {
        dirtyRef.current = dirty
    }, [dirty])

    const keep = useCallback((next: EditorialArticle) => {
        articleRef.current = next
        setArticle(next)
    }, [])

    const putIntoEditor = useCallback(
        (html: string): string => {
            if (!editor) return html
            editor.commands.setContent(html, { emitUpdate: false })
            const normalized = htmlOf(editor)
            setContent(normalized)
            return normalized
        },
        [editor]
    )

    // What the browser kept for this article that the server does not have
    const offerBuffer = useCallback(
        (loaded: EditorialArticle, serverSnapshot: string) => {
            const buffer = readBuffer(sub, loaded.id)
            if (buffer === null) return
            const frozen = loaded.firstPublishedAt !== null
            if (
                snapshotOf(buffer.metadata, buffer.content) === serverSnapshot ||
                (frozen && buffer.metadata.type !== loaded.type)
            ) {
                removeBuffer(sub, loaded.id)
                return
            }
            const since =
                buffer.baseVersion === loaded.version
                    ? ''
                    : '\n\nС тех пор материал сохраняли: при следующем сохранении эта версия заменит сохранённую.'
            const question = `Есть несохранённые изменения от ${timeOf(buffer.savedAt)}. Восстановить их?${since}`
            if (!window.confirm(question)) {
                removeBuffer(sub, loaded.id)
                return
            }
            putIntoEditor(buffer.content)
            setMetadata(frozen ? { ...buffer.metadata, slug: loaded.slug ?? '' } : buffer.metadata)
        },
        [sub, putIntoEditor]
    )

    // Take the server's copy as it is, as after opening or after an edit is dropped
    const adoptLoaded = useCallback(
        (loaded: EditorialArticle, offer: boolean) => {
            keep(loaded)
            const loadedMetadata = metadataOf(loaded)
            const html = putIntoEditor(loaded.working.content ?? '')
            const snapshot = snapshotOf(loadedMetadata, html)
            setMetadata(loadedMetadata)
            setBaseline(snapshot)
            setLoadState('ready')
            if (offer && loaded.lockedBy === null) offerBuffer(loaded, snapshot)
        },
        [keep, putIntoEditor, offerBuffer]
    )

    // After a save or a publish. What was typed while the request travelled stays, and
    // stays dirty: the baseline is what the server now holds, not what the form holds.
    const adoptSaved = useCallback(
        (saved: EditorialArticle, sent: ContentMetadata) => {
            keep(saved)
            const savedMetadata = metadataOf(saved)
            setBaseline(snapshotOf(savedMetadata, saved.working.content ?? ''))
            setMetadata((current) =>
                current.slug === sent.slug ? { ...current, slug: savedMetadata.slug } : current
            )
        },
        [keep]
    )

    // -- Opening --

    useEffect(() => {
        if (!editor || articleId === null || articleRef.current?.id === articleId) return
        let cancelled = false
        articlesApi.get(articleId).then(
            (loaded) => {
                if (!cancelled) adoptLoaded(loaded, true)
            },
            (error: unknown) => {
                if (!cancelled) setLoadState(loadStateOf(error))
            }
        )
        return () => {
            cancelled = true
        }
    }, [editor, articleId, adoptLoaded])

    useEffect(() => {
        if (!editor || pending === null || restoredRef.current) return
        restoredRef.current = true
        editor.commands.setContent(pending.content)
        showSnackbar('Восстановлен несохранённый материал', 'info')
    }, [editor, pending, showSnackbar])

    useEffect(() => {
        editor?.setEditable(mode !== 'locked')
    }, [editor, mode])

    // -- Keeping what is not saved --

    useEffect(() => {
        if (loadState !== 'ready' || mode === 'locked') return
        const key = article?.id ?? NEW
        if (!dirty) {
            removeBuffer(sub, key)
            return
        }
        const timer = setTimeout(() => {
            writeBuffer(sub, key, {
                baseVersion: article?.version ?? null,
                metadata,
                content,
                savedAt: new Date().toISOString(),
            })
        }, 500)
        return () => clearTimeout(timer)
    }, [sub, article, loadState, mode, dirty, metadata, content])

    // -- Actions --

    // One request at a time; the ref, not the state, because two clicks can land in
    // the same render
    const run = useCallback(
        async <T>(kind: Exclude<Busy, null>, action: () => Promise<T>): Promise<T | null> => {
            if (busyRef.current) return null
            busyRef.current = true
            setBusy(kind)
            try {
                return await action()
            } catch (error) {
                console.error(`${kind} failed:`, error)
                showSnackbar(messageOf(error), 'error')
                return null
            } finally {
                busyRef.current = false
                setBusy(null)
            }
        },
        [showSnackbar]
    )

    const save = useCallback(async (): Promise<EditorialArticle | null> => {
        if (!editor) return null
        if (!metadata.title.trim()) {
            showSnackbar('Заполните заголовок', 'error')
            return null
        }
        const sent = metadata
        const html = htmlOf(editor)
        return run('save', async () => {
            const current = articleRef.current
            const saved =
                current === null
                    ? await articlesApi.create(createRequestOf(sent, html))
                    : await articlesApi.save(current.id, saveRequestOf(current.version, sent, html))
            adoptSaved(saved, sent)
            if (current === null) {
                removeBuffer(sub, NEW)
                // the same article at its own address: the route keeps this page mounted
                void navigate(`/editor/${saved.id}`, {
                    replace: true,
                    state: { continues: sessionKey },
                })
            }
            showSnackbar(
                current === null
                    ? 'Черновик создан'
                    : saved.status === 'draft'
                      ? 'Черновик сохранён'
                      : 'Правка сохранена, на сайте пока прежняя версия',
                'success'
            )
            return saved
        })
    }, [editor, metadata, run, adoptSaved, sub, navigate, sessionKey, showSnackbar])

    // A draft goes on the site; for a published article, the pending edit does. Whatever
    // the form holds is saved first, so what goes out is what is on the screen.
    const publish = useCallback(async () => {
        if (!editor) return
        const problem = publishProblem(metadata, htmlOf(editor))
        if (problem) {
            showSnackbar(problem, 'error')
            return
        }
        let current = articleRef.current
        if (current === null || dirtyRef.current) {
            current = await save()
            if (current === null) return
        }
        if (current.status === 'published' && current.live === null) {
            showSnackbar('Неопубликованных правок нет', 'info')
            return
        }
        const target = current
        const sent = metadata
        await run('publish', async () => {
            const published = await articlesApi.publish(target.id, target.version)
            adoptSaved(published, sent)
            // The site caches its pages for a minute, and the first visit after that still
            // gets the old copy; the new page itself is there at once, the feeds are not
            if (target.status === 'draft') {
                const what =
                    published.type === 'article' ? 'Статья опубликована' : 'Новость опубликована'
                showSnackbar(`${what}, в лентах сайта появится в течение пары минут`, 'success')
            } else {
                showSnackbar(
                    'Изменения опубликованы, на сайте появятся в течение пары минут',
                    'success'
                )
            }
        })
    }, [editor, metadata, save, run, adoptSaved, showSnackbar])

    // The holder drops his edit; a chief editor resets someone else's without seeing it
    const discardEdit = useCallback(async () => {
        const current = articleRef.current
        if (current === null) return
        const own = current.lockedBy === null
        const question = own
            ? 'Отменить правку? Сохранённые в ней изменения пропадут, на сайте останется текущая версия.'
            : `Сбросить правку, которую держит ${current.lockedBy}? Его изменения пропадут.`
        if (!window.confirm(question)) return
        await run('discard', async () => {
            await articlesApi.discardEdit(current.id)
            removeBuffer(sub, current.id)
            adoptLoaded(await articlesApi.get(current.id), false)
            showSnackbar(own ? 'Правка отменена' : 'Правка сброшена', 'info')
        })
    }, [run, sub, adoptLoaded, showSnackbar])

    const remove = useCallback(async () => {
        const current = articleRef.current
        if (current === null || !window.confirm('Удалить черновик? Это не отменить.')) return
        await run('delete', async () => {
            await articlesApi.delete(current.id)
            removeBuffer(sub, current.id)
            leavingRef.current = true
            void navigate('/desk', { replace: true })
        })
    }, [run, sub, navigate])

    // A chief editor takes a published article off the site. It goes back to its owner as a
    // draft, and the owner may not be the caller, so the editor leaves for the desk.
    const unpublish = useCallback(async () => {
        const current = articleRef.current
        if (current === null) return
        const unsaved = dirtyRef.current ? ' Несохранённые изменения пропадут.' : ''
        const question = `Снять материал с публикации? Он вернётся автору черновиком, а с сайта пропадёт в течение пары минут.${unsaved}`
        if (!window.confirm(question)) return
        await run('unpublish', async () => {
            await articlesApi.unpublish(current.id)
            removeBuffer(sub, current.id)
            leavingRef.current = true
            void navigate('/desk', {
                replace: true,
                state: { notice: 'Материал снят с публикации и вернулся автору черновиком' },
            })
        })
    }, [run, sub, navigate])

    // A new article only: back to an empty form
    const clearNew = useCallback(() => {
        if (!editor || !window.confirm('Очистить редактор? Всё введённое пропадёт.')) return
        editor.commands.clearContent()
        setMetadata((current) =>
            current.type === 'article' ? defaultArticleMetadata : defaultNewsMetadata
        )
        removeBuffer(sub, NEW)
    }, [editor, sub])

    // Leaving on purpose throws the unsaved part away; closing the tab keeps it
    const forgetUnsaved = useCallback(() => {
        removeBuffer(sub, articleRef.current?.id ?? NEW)
    }, [sub])

    return {
        editor,
        loadState,
        article,
        mode,
        metadata,
        setMetadata,
        content,
        dirty,
        busy,
        dirtyRef,
        leavingRef,
        save,
        publish,
        discardEdit,
        remove,
        unpublish,
        clearNew,
        forgetUnsaved,
    }
}
