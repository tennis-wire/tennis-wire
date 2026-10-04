import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

import { foreignPictureLinks, stripForeignMedia, withCopies } from '../lib/media'
import { askCaption } from './Figure'

type Severity = 'success' | 'error' | 'warning' | 'info'

// copy them, paste without them, or cancel the paste (null)
export type CopyQuestion = (count: number) => Promise<boolean | null>

export interface PictureInputStorage {
    askToCopy: CopyQuestion | null
    // set by the screen that can ask; until then pictures from elsewhere are simply left out
    setCopyQuestion(ask: CopyQuestion | null): void
}

declare module '@tiptap/core' {
    interface Storage {
        pictureInput: PictureInputStorage
    }
}

export interface PictureInputOptions {
    // the file uploaded, its address in the bucket back
    upload: (file: File) => Promise<string>
    // the picture behind a link copied into the bucket, its address there back
    copy: (link: string) => Promise<string>
    errorMessage: (error: unknown) => string
    notify: (message: string, severity: Severity) => void
}

const FOREIGN = 'Картинки с других сайтов не вставляются: сохраните файл и загрузите его'

function picturesOf(files: FileList | undefined): File[] {
    return Array.from(files ?? []).filter((file) => file.type.startsWith('image/'))
}

// How pictures come into the text besides the toolbar. A file pasted or dropped is uploaded and
// lands where it was pasted or dropped. Pasted or dropped html with pictures from elsewhere asks
// first: copied into the bucket they go in with the text, otherwise the text goes in without them.
export const PictureInput = Extension.create<PictureInputOptions, PictureInputStorage>({
    name: 'pictureInput',

    // Tiptap keeps a copy of what this returns, so the setter writes to whatever object it is
    // called on, not to this one
    addStorage() {
        return {
            askToCopy: null,
            setCopyQuestion(this: PictureInputStorage, ask: CopyQuestion | null) {
                this.askToCopy = ask
            },
        }
    },

    addOptions() {
        return {
            upload: () => Promise.reject(new Error('No upload configured')),
            copy: () => Promise.reject(new Error('No copy configured')),
            errorMessage: () => 'Не удалось загрузить изображение',
            notify: () => {},
        }
    },

    addProseMirrorPlugins() {
        const { editor, storage } = this
        const { upload, copy, errorMessage, notify } = this.options

        // Uploads take a while: the place is kept as a position and clamped to the document as
        // it is by then, since the author may have typed on
        const clamp = (pos: number) => Math.min(pos, editor.state.doc.content.size)

        const insert = async (files: File[], at: number) => {
            const results = await Promise.allSettled(files.map((file) => upload(file)))
            const urls = results.flatMap((result) =>
                result.status === 'fulfilled' ? [result.value] : []
            )
            if (urls.length > 0) {
                editor
                    .chain()
                    .focus()
                    .insertContentAt(
                        clamp(at),
                        urls.map((src) => ({ type: 'image', attrs: { src } }))
                    )
                    .run()
            }
            const failed = results.find((result) => result.status === 'rejected')
            if (failed) {
                const rest = urls.length > 0 ? `. Добавлено: ${urls.length} из ${files.length}` : ''
                notify(`${errorMessage(failed.reason)}${rest}`, 'error')
            }
        }

        // The html goes in where it was pasted or dropped once the author has answered and the
        // copies are made. A picture that could not be copied stays out, and the author is told.
        const insertCopying = async (html: string, links: string[], from: number, to: number) => {
            const answer = storage.askToCopy ? await storage.askToCopy(links.length) : false
            if (answer === null) return

            const copies = new Map<string, string>()
            let failure: unknown = null
            if (answer) {
                const results = await Promise.allSettled(links.map((link) => copy(link)))
                results.forEach((result, i) => {
                    if (result.status === 'fulfilled') copies.set(links[i], result.value)
                    else failure ??= result.reason
                })
            }

            const kept = stripForeignMedia(withCopies(html, copies)).html
            if (copies.size === 1) askCaption(editor, [...copies.values()][0])
            editor
                .chain()
                .focus()
                .insertContentAt({ from: clamp(from), to: clamp(to) }, kept)
                .run()

            if (failure !== null) {
                const lost = links.length - copies.size
                notify(
                    `Не скопировано картинок: ${lost} из ${links.length}. ${errorMessage(failure)}`,
                    'warning'
                )
            } else if (copies.size > 1) {
                notify('Картинки скопированы. Укажите у каждой автора: клик по картинке', 'info')
            }
        }

        // Pictures from elsewhere in the html: a question when some can be copied, a note when
        // there are only ones that cannot be (pasted as data). False: nothing to do here.
        const takeHtml = (html: string | undefined, from: number, to: number): boolean => {
            if (!html) return false
            const links = foreignPictureLinks(html)
            if (links.length > 0) {
                void insertCopying(html, links, from, to)
                return true
            }
            if (stripForeignMedia(html).dropped > 0) notify(FOREIGN, 'warning')
            return false
        }

        return [
            new Plugin({
                key: new PluginKey('pictureInput'),
                props: {
                    // what the handlers below let through: no picture from elsewhere is left in it
                    transformPastedHTML(html) {
                        return stripForeignMedia(html).html
                    },

                    // A picture copied in a browser comes as a file and as html with its address:
                    // the file wins, so it ends up in the bucket with no question asked
                    handlePaste(view, event) {
                        const files = picturesOf(event.clipboardData?.files)
                        const { from, to } = view.state.selection
                        if (files.length === 0) {
                            return takeHtml(event.clipboardData?.getData('text/html'), from, to)
                        }
                        void insert(files, from)
                        return true
                    },

                    // a picture dragged over from another tab comes as html, not as a file
                    handleDrop(view, event, _slice, moved) {
                        if (moved || !event.dataTransfer) return false
                        const pointer = { left: event.clientX, top: event.clientY }
                        const at = view.posAtCoords(pointer)?.pos ?? view.state.selection.from
                        if (event.dataTransfer.files.length === 0) {
                            return takeHtml(event.dataTransfer.getData('text/html'), at, at)
                        }
                        const files = picturesOf(event.dataTransfer.files)
                        if (files.length === 0) {
                            notify('Можно перетаскивать только изображения', 'warning')
                            return true
                        }
                        void insert(files, at)
                        return true
                    },
                },
            }),
        ]
    },
})

export default PictureInput
