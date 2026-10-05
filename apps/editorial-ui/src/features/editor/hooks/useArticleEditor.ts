import { ReactNodeViewRenderer, useEditor, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Heading from '@tiptap/extension-heading'
import Placeholder from '@tiptap/extension-placeholder'
import Youtube from '@tiptap/extension-youtube'
import { importImage, pictureOf, uploadErrorMessage, uploadImage } from '../api/mediaApi'
import { FigureView } from '../components/FigureView'
import { Figure, PictureInput, Poll, Telegram, Video } from '../extensions'

type Notify = (message: string, severity: 'success' | 'error' | 'warning' | 'info') => void

// The site draws the title as the page's only h1, and the toolbar offers h2 and h3. A heading of
// another level, pasted or from the AI chat's markdown, takes the nearest of the two rather than
// falling to a plain paragraph.
const ArticleHeading = Heading.extend({
    parseHTML() {
        return [
            ...(this.parent?.() ?? []),
            { tag: 'h1', attrs: { level: 2 } },
            ...['h4', 'h5', 'h6'].map((tag) => ({ tag, attrs: { level: 3 } })),
        ]
    },
}).configure({ levels: [2, 3] })

// What an article may hold: no more than the toolbar can make. Code has no button and no look on
// the site, so a backtick, a pasted <code> or a markdown fence leaves plain text.
export function articleExtensions(notify: Notify = () => {}) {
    return [
        StarterKit.configure({
            code: false,
            codeBlock: false,
            heading: false,
            link: { openOnClick: false },
        }),
        ArticleHeading,
        Figure.extend({ addNodeView: () => ReactNodeViewRenderer(FigureView) }),
        Youtube.configure({ controls: true, nocookie: true, modestBranding: true }),
        Telegram,
        Video,
        Poll,
        Placeholder.configure({ placeholder: 'Начните писать...' }),
        PictureInput.configure({
            upload: async (file) => pictureOf(await uploadImage(file)),
            copy: async (link) => pictureOf(await importImage(link)),
            errorMessage: uploadErrorMessage,
            notify,
        }),
    ]
}

// An empty document reads as '' rather than '<p></p>', so a blank article compares
// equal to one that was never typed into
export function htmlOf(editor: Editor): string {
    return editor.isEmpty ? '' : editor.getHTML()
}

// The editor is built once, with the notify of the first render: it has to be a stable one
export function useArticleEditor(onChange: (html: string) => void, notify: Notify) {
    return useEditor({
        extensions: articleExtensions(notify),
        content: '',
        onUpdate: ({ editor }) => onChange(htmlOf(editor)),
    })
}
