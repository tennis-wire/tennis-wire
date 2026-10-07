import { Editor, type EditorOptions } from '@tiptap/core'

const live: Editor[] = []

// ProseMirror flushes its DOM observer on a timer. An editor still alive when its test file ends
// fires that timer after jsdom is gone, and Vitest fails the run on the ReferenceError
export function testEditor(options: Partial<EditorOptions>): Editor {
    const editor = new Editor(options)
    live.push(editor)
    return editor
}

// For afterEach: destroy() drops the view's docView, and a flush that comes late returns at once
export function destroyEditors(): void {
    live.splice(0).forEach((editor) => editor.destroy())
}
