// @vitest-environment jsdom
import type { Editor } from '@tiptap/core'
import { afterEach, describe, expect, it } from 'vitest'

import { markdownToHtml } from '../lib/markdown'
import { destroyEditors, testEditor } from '../testEditor'
import { articleExtensions } from './useArticleEditor'

function editor(content?: string): Editor {
    return testEditor({ extensions: articleExtensions(), content })
}

afterEach(destroyEditors)

describe('article schema', () => {
    it('drops code from a heading and keeps the heading', () => {
        expect(editor('<h2><code>Рублёв — Боржеш</code></h2>').getHTML()).toBe(
            '<h2>Рублёв — Боржеш</h2>'
        )
    })

    it('moves headings to the two levels the toolbar has', () => {
        expect(editor('<h1>A</h1><h4>B</h4><h6>C</h6>').getHTML()).toBe(
            '<h2>A</h2><h3>B</h3><h3>C</h3>'
        )
    })

    it('reads a code block as a paragraph', () => {
        expect(editor('<pre><code>x</code></pre>').getHTML()).toBe('<p>x</p>')
    })

    it('takes the AI chat markdown on the same terms', () => {
        const e = editor()

        e.commands.insertContent(markdownToHtml('# A\n\nтекст с `кодом`'))

        expect(e.getHTML()).toBe('<h2>A</h2><p>текст с кодом</p>')
    })
})
