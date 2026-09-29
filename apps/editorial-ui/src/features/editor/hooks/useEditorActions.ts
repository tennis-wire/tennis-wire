import { useCallback } from 'react'
import type { Editor } from '@tiptap/react'

import { paragraphsOf } from '../lib/paragraphs'

type Severity = 'success' | 'error' | 'warning' | 'info'

interface Params {
    editor: Editor | null
    originalContent: string | undefined
    showSnackbar: (message: string, severity: Severity) => void
}

// What the toolbar, the dialogs and the original-text tabs do to the text itself
export function useEditorActions({ editor, originalContent, showSnackbar }: Params) {
    const handleReset = useCallback(() => {
        if (!originalContent) {
            showSnackbar('Нет оригинала для восстановления', 'warning')
            return
        }
        if (editor && window.confirm('Вернуться к оригиналу? Текущие изменения будут потеряны.')) {
            editor.commands.setContent(originalContent)
            showSnackbar('Восстановлен оригинальный текст', 'info')
        }
    }, [editor, originalContent, showSnackbar])

    const insertBelow = useCallback(
        (text: string) => {
            editor?.chain().focus().insertContent(paragraphsOf(text)).run()
        },
        [editor]
    )

    const getSelectedText = useCallback((): string => {
        if (!editor) return ''
        const { from, to } = editor.state.selection
        // the paragraphs go to DeepL as blank lines, or the translation comes back as one
        return editor.state.doc.textBetween(from, to, '\n\n')
    }, [editor])

    return { handleReset, insertBelow, getSelectedText }
}
