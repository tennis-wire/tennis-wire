import { useEditor, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import Youtube from '@tiptap/extension-youtube'
import { Poll, Telegram, Video } from '../extensions'

// An empty document reads as '' rather than '<p></p>', so a blank article compares
// equal to one that was never typed into
export function htmlOf(editor: Editor): string {
    return editor.isEmpty ? '' : editor.getHTML()
}

export function useArticleEditor(onChange: (html: string) => void) {
    return useEditor({
        extensions: [
            StarterKit.configure({
                heading: { levels: [1, 2, 3] },
                link: { openOnClick: false },
            }),
            Image,
            Youtube.configure({ controls: true, nocookie: true, modestBranding: true }),
            Telegram,
            Video,
            Poll,
            Placeholder.configure({ placeholder: 'Начните писать...' }),
        ],
        content: '',
        onUpdate: ({ editor }) => onChange(htmlOf(editor)),
    })
}
