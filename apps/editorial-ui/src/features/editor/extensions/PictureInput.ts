import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

import { stripForeignMedia } from '../lib/media'

type Severity = 'success' | 'error' | 'warning' | 'info'

export interface PictureInputOptions {
    // the file uploaded, its address in the bucket back
    upload: (file: File) => Promise<string>
    errorMessage: (error: unknown) => string
    notify: (message: string, severity: Severity) => void
}

const FOREIGN = 'Картинки с других сайтов не вставляются: сохраните файл и загрузите его'

function picturesOf(files: FileList | undefined): File[] {
    return Array.from(files ?? []).filter((file) => file.type.startsWith('image/'))
}

// How pictures come into the text besides the toolbar button. A file pasted or dropped is
// uploaded and lands where it was pasted or dropped. Pictures in pasted or dropped html are kept
// only if they are already in the bucket.
export const PictureInput = Extension.create<PictureInputOptions>({
    name: 'pictureInput',

    addOptions() {
        return {
            upload: () => Promise.reject(new Error('No upload configured')),
            errorMessage: () => 'Не удалось загрузить изображение',
            notify: () => {},
        }
    },

    addProseMirrorPlugins() {
        const { editor } = this
        const { upload, errorMessage, notify } = this.options

        // Uploads take a while: the place is kept as a position and clamped to the document as
        // it is by then, since the author may have typed on
        const insert = async (files: File[], at: number) => {
            const results = await Promise.allSettled(files.map(upload))
            const urls = results.flatMap((result) =>
                result.status === 'fulfilled' ? [result.value] : []
            )
            if (urls.length > 0) {
                const pos = Math.min(at, editor.state.doc.content.size)
                editor
                    .chain()
                    .focus()
                    .insertContentAt(
                        pos,
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

        return [
            new Plugin({
                key: new PluginKey('pictureInput'),
                props: {
                    transformPastedHTML(html) {
                        const kept = stripForeignMedia(html)
                        if (kept.dropped > 0) notify(FOREIGN, 'warning')
                        return kept.html
                    },

                    // A picture copied in a browser comes as a file and as html with its address:
                    // the file wins, so it ends up in the bucket rather than dropped as foreign
                    handlePaste(view, event) {
                        const files = picturesOf(event.clipboardData?.files)
                        if (files.length === 0) return false
                        void insert(files, view.state.selection.from)
                        return true
                    },

                    handleDrop(view, event, _slice, moved) {
                        if (moved || !event.dataTransfer?.files.length) return false
                        const files = picturesOf(event.dataTransfer.files)
                        if (files.length === 0) {
                            notify('Можно перетаскивать только изображения', 'warning')
                            return true
                        }
                        const dropped = view.posAtCoords({
                            left: event.clientX,
                            top: event.clientY,
                        })
                        void insert(files, dropped?.pos ?? view.state.selection.from)
                        return true
                    },
                },
            }),
        ]
    },
})

export default PictureInput
