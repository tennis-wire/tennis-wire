import { Node, mergeAttributes } from '@tiptap/core'

export interface VideoOptions {
    HTMLAttributes: Record<string, unknown>
    allowedTypes: string[]
}

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        video: {
            setVideo: (options: { src: string }) => ReturnType
        }
    }
}

export const isVideoUrl = (url: string): boolean => {
    const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.m4v']
    const lowercaseUrl = url.toLowerCase()
    return videoExtensions.some((ext) => lowercaseUrl.includes(ext))
}

export const Video = Node.create<VideoOptions>({
    name: 'video',

    addOptions() {
        return {
            HTMLAttributes: {},
            allowedTypes: ['video/mp4', 'video/webm', 'video/ogg'],
        }
    },

    group: 'block',

    atom: true,

    addAttributes() {
        return {
            src: {
                default: null,
            },
        }
    },

    parseHTML() {
        return [
            {
                tag: 'video',
            },
            {
                tag: 'div[data-video]',
            },
        ]
    },

    renderHTML({ HTMLAttributes }) {
        return [
            'div',
            mergeAttributes(this.options.HTMLAttributes, {
                'data-video': '',
                class: 'video-embed',
            }),
            [
                'video',
                {
                    src: HTMLAttributes.src,
                    controls: true,
                    preload: 'metadata',
                    style: 'width: 100%; max-width: 100%; border-radius: 8px;',
                },
            ],
        ]
    },

    addCommands() {
        return {
            setVideo:
                (options) =>
                ({ commands }) => {
                    return commands.insertContent({
                        type: this.name,
                        attrs: {
                            src: options.src,
                        },
                    })
                },
        }
    },
})

export default Video
