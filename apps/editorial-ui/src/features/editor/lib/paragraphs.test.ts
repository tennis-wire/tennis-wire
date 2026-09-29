// @vitest-environment jsdom
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { describe, expect, it } from 'vitest'

import { paragraphsOf } from './paragraphs'

const p = (...content: object[]) => ({ type: 'paragraph', content })
const t = (text: string) => ({ type: 'text', text })

describe('paragraphsOf', () => {
    it('starts a paragraph at every blank line', () => {
        expect(paragraphsOf('One.\n\nTwo.\n  \nThree.')).toEqual([
            p(t('One.')),
            p(t('Two.')),
            p(t('Three.')),
        ])
    })

    it('keeps a single newline as a line break', () => {
        expect(paragraphsOf('[00:01] A: yes\n[00:02] B: no')).toEqual([
            p(t('[00:01] A: yes'), { type: 'hardBreak' }, t('[00:02] B: no')),
        ])
    })

    it('reads Windows line ends as newlines', () => {
        expect(paragraphsOf('One.\r\n\r\nTwo.')).toEqual([p(t('One.')), p(t('Two.'))])
    })

    it('leaves markup in the text as text', () => {
        expect(paragraphsOf('<b>5 < 6</b> & more')).toEqual([p(t('<b>5 < 6</b> & more'))])
    })

    it('gives nothing for blank text', () => {
        expect(paragraphsOf('')).toEqual([])
        expect(paragraphsOf('\n\n  \n')).toEqual([])
    })

    it('lands in the article as paragraphs of their own', () => {
        const e = new Editor({ extensions: [StarterKit], content: '<p>Before</p>' })
        e.commands.focus('end')

        e.commands.insertContent(paragraphsOf('One & two.\n\nThree.'))

        expect(e.getHTML()).toBe('<p>Before</p><p>One &amp; two.</p><p>Three.</p>')
    })
})
