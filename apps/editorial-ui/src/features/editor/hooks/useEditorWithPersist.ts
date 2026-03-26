import { useState, useEffect } from 'react'
import { useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import Youtube from '@tiptap/extension-youtube'
import { Telegram, Video } from '../extensions'
import type { ContentMetadata } from '../types/content'
import { defaultNewsMetadata } from '../types/content'

const CONTENT_KEY = 'editor-content'
const METADATA_KEY = 'editor-metadata'

export function useEditorWithPersist() {
    const [metadata, setMetadata] = useState<ContentMetadata>({ ...defaultNewsMetadata })
    const [originalContent, setOriginalContent] = useState<string | undefined>(undefined)

    const editor = useEditor({
        extensions: [
            StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
            Underline,
            Link.configure({ openOnClick: false }),
            Image,
            Youtube.configure({ controls: true, nocookie: true, modestBranding: true }),
            Telegram,
            Video,
            Placeholder.configure({ placeholder: 'Начните писать...' }),
        ],
        content: '',
        onUpdate: ({ editor }) => {
            localStorage.setItem(CONTENT_KEY, editor.getHTML())
        },
    })

    // download из localStorage
    useEffect(() => {
        if (!editor) return
        const savedContent = localStorage.getItem(CONTENT_KEY)
        if (savedContent) editor.commands.setContent(savedContent)

        const savedMeta = localStorage.getItem(METADATA_KEY)
        if (savedMeta) {
            try {
                setMetadata(JSON.parse(savedMeta))
            } catch (e) {
                console.error('Ошибка загрузки метаданных:', e)
            }
        }
    }, [editor])

    useEffect(() => {
        const timer = setTimeout(() => {
            localStorage.setItem(METADATA_KEY, JSON.stringify(metadata))
        }, 1000)
        return () => clearTimeout(timer)
    }, [metadata])

    const clearPersisted = () => {
        localStorage.removeItem(CONTENT_KEY)
        localStorage.removeItem(METADATA_KEY)
    }

    return { editor, metadata, setMetadata, originalContent, setOriginalContent, clearPersisted }
}
