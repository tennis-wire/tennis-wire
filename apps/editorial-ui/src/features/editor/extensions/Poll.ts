import { Node, mergeAttributes } from '@tiptap/core'

export interface PollAttrs {
    pollId: string
    question: string
    options: string[]
}

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        poll: {
            setPoll: (attrs: PollAttrs) => ReturnType
        }
    }
}

// The article carries the poll's id, and the wording as it was when the poll was placed. The
// public site swaps the block for the live widget by id; what is written here is what a reader
// with no script, and a search engine, get to see.
export const Poll = Node.create({
    name: 'poll',

    group: 'block',

    atom: true,

    draggable: true,

    addAttributes() {
        return {
            pollId: {
                default: null,
                parseHTML: (element) => element.getAttribute('data-poll'),
                renderHTML: (attrs) => ({ 'data-poll': attrs.pollId }),
            },
            question: {
                default: '',
                parseHTML: (element) => element.querySelector('.poll-question')?.textContent ?? '',
                renderHTML: () => ({}),
            },
            options: {
                default: [],
                parseHTML: (element) =>
                    Array.from(element.querySelectorAll('li'), (li) => li.textContent ?? ''),
                renderHTML: () => ({}),
            },
        }
    },

    parseHTML() {
        return [{ tag: 'div[data-poll]' }]
    },

    renderHTML({ node, HTMLAttributes }) {
        const { question, options } = node.attrs as PollAttrs
        return [
            'div',
            mergeAttributes(HTMLAttributes, { class: 'poll-embed' }),
            ['p', { class: 'poll-question' }, question],
            [
                'ol',
                { class: 'poll-options' },
                ...options.map((text): [string, string] => ['li', text]),
            ],
        ]
    },

    addCommands() {
        return {
            setPoll:
                (attrs) =>
                ({ commands }) =>
                    commands.insertContent({ type: this.name, attrs }),
        }
    },
})

export default Poll
