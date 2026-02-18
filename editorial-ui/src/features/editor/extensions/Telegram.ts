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
    const match = url.match(/(?:t\.me|telegram\.me)\/([^/]+)\/(\d+)/)
    if (match) {
        return { channel: match[1], postId: match[2] }
    }
    return null
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
            src: {
                default: null,
            },
            channel: {
                default: null,
            },
            postId: {
                default: null,
            },
        }
    },

    parseHTML() {
        return [
            {
                tag: 'div[data-telegram-post]',
            },
        ]
    },

    renderHTML({ HTMLAttributes }) {
        const { channel, postId } = HTMLAttributes
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
                        attrs: {
                            src: options.src,
                            channel: data.channel,
                            postId: data.postId,
                        },
                    })
                },
        }
    },
})

export default Telegram
