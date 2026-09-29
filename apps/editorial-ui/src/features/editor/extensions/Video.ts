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
            // a bare <video> carries src itself, the saved embed keeps it on the inner <video>
            src: {
                default: null,
                parseHTML: (element) =>
                    element.getAttribute('src') ??
                    element.querySelector('video')?.getAttribute('src') ??
                    null,
                renderHTML: () => ({}),
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

    renderHTML({ node }) {
        return [
            'div',
            mergeAttributes(this.options.HTMLAttributes, {
                'data-video': '',
                class: 'video-embed',
            }),
            [
                'video',
                {
                    src: node.attrs.src,
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
