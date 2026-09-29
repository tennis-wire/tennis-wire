import { Node, mergeAttributes } from '@tiptap/core'

export interface TelegramOptions {
    HTMLAttributes: Record<string, unknown>
}

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        telegram: {
            setTelegramPost: (options: { src: string }) => ReturnType
        }
    }
}

export const extractTelegramData = (url: string): { channel: string; postId: string } | null => {
    const match = url.match(/(?:t\.me|telegram\.me)\/(\w+)\/(\d+)/)
    if (match) {
        return { channel: match[1], postId: match[2] }
    }
    return null
}

// A saved article keeps the post in one place only, data-telegram-post="channel/123"
const POST = /^(\w+)\/(\d+)$/

function postOf(element: HTMLElement): RegExpMatchArray | null {
    return (element.getAttribute('data-telegram-post') ?? '').match(POST)
}

export const Telegram = Node.create<TelegramOptions>({
    name: 'telegram',

    addOptions() {
        return {
            HTMLAttributes: {},
        }
    },

    group: 'block',

    atom: true,

    addAttributes() {
        return {
            channel: {
                default: null,
                parseHTML: (element) => postOf(element)?.[1] ?? null,
                renderHTML: () => ({}),
            },
            postId: {
                default: null,
                parseHTML: (element) => postOf(element)?.[2] ?? null,
                renderHTML: () => ({}),
            },
        }
    },

    parseHTML() {
        return [
            {
                tag: 'div[data-telegram-post]',
                getAttrs: (element) => (postOf(element) ? null : false),
            },
        ]
    },

    renderHTML({ node }) {
        const { channel, postId } = node.attrs
        const embedUrl = `https://t.me/${channel}/${postId}?embed=1&mode=tme`

        return [
            'div',
            mergeAttributes(this.options.HTMLAttributes, {
                'data-telegram-post': `${channel}/${postId}`,
                class: 'telegram-embed',
            }),
            [
                'iframe',
                {
                    src: embedUrl,
                    width: '100%',
                    height: '400',
                    frameborder: '0',
                    scrolling: 'no',
                    style: 'border: none; overflow: hidden; border-radius: 8px;',
                },
            ],
        ]
    },

    addCommands() {
        return {
            setTelegramPost:
                (options) =>
                ({ commands }) => {
                    const data = extractTelegramData(options.src)
                    if (!data) return false

                    return commands.insertContent({
                        type: this.name,
                        attrs: data,
                    })
                },
        }
    },
})

export default Telegram
