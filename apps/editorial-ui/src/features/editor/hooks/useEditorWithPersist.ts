import { useState, useEffect } from 'react'
import { useEditor } from '@tiptap/react'
import { useAuth } from 'react-oidc-context'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import Youtube from '@tiptap/extension-youtube'
import { Telegram, Video } from '../extensions'
import type { ContentMetadata } from '../types/content'
import { defaultNewsMetadata } from '../types/content'

// Written before the editor knew who was using it. Dropped rather than
// migrated: guessing whose draft it was is worse than losing one.
const UNOWNED_KEYS = ['editor-content', 'editor-metadata']

function loadMetadata(key: string | null): ContentMetadata {
    const saved = key === null ? null : localStorage.getItem(key)
    if (saved) {
        try {
            return JSON.parse(saved)
        } catch (e) {
            console.error('Ошибка загрузки метаданных:', e)
        }
    }
    return { ...defaultNewsMetadata }
}

export function useEditorWithPersist() {
    const auth = useAuth()
    // The editor only mounts inside RequireAuth, so this is set on the first
    // render. The null branches below exist so that a draft can never be
    // written to a key somebody else would read.
    const sub = auth.user?.profile.sub
    const contentKey = sub === undefined ? null : `editor-content:${sub}`
    const metadataKey = sub === undefined ? null : `editor-metadata:${sub}`

    const [metadata, setMetadata] = useState<ContentMetadata>(() => loadMetadata(metadataKey))
    const [originalContent, setOriginalContent] = useState<string | undefined>(undefined)

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: { levels: [1, 2, 3] },
                link: { openOnClick: false },
            }),
            Image,
            Youtube.configure({ controls: true, nocookie: true, modestBranding: true }),
            Telegram,
            Video,
            Placeholder.configure({ placeholder: 'Начните писать...' }),
        ],
        content: '',
        onUpdate: ({ editor }) => {
            if (contentKey === null) return
            localStorage.setItem(contentKey, editor.getHTML())
        },
    })

    // одноразовая уборка ключей, писавшихся до появления логина
    useEffect(() => {
        for (const key of UNOWNED_KEYS) localStorage.removeItem(key)
    }, [])

    // восстановление контента из localStorage
    useEffect(() => {
        if (!editor || contentKey === null) return
        const savedContent = localStorage.getItem(contentKey)
        if (savedContent) editor.commands.setContent(savedContent)
    }, [editor, contentKey])

    // дебаунс-сохранение метаданных
    useEffect(() => {
        if (metadataKey === null) return
        const timer = setTimeout(() => {
            localStorage.setItem(metadataKey, JSON.stringify(metadata))
        }, 1000)
        return () => clearTimeout(timer)
    }, [metadata, metadataKey])

    const clearPersisted = () => {
        if (contentKey === null || metadataKey === null) return
        localStorage.removeItem(contentKey)
        localStorage.removeItem(metadataKey)
    }

    return { editor, metadata, setMetadata, originalContent, setOriginalContent, clearPersisted }
}
