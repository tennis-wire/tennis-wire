import sanitizeHtml from 'sanitize-html'

import { originOf } from '@/lib/security/csp'

import { EMBED_HOSTS } from './embeds'

// What the editor emits (editorial-ui: TipTap StarterKit, Image, Youtube and the two embeds of
// its own), and nothing it does not. The source is staff, but a staff account is one phishing
// away, and a script on this page would talk to the proxy with the reader's session.
const OPTIONS: sanitizeHtml.IOptions = {
    allowedTags: [
        'p',
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'blockquote',
        'pre',
        'code',
        'hr',
        'br',
        'strong',
        'b',
        'em',
        'i',
        's',
        'u',
        'a',
        'ul',
        'ol',
        'li',
        'img',
        'figure',
        'figcaption',
        'div',
        'iframe',
        'video',
    ],
    allowedAttributes: {
        // no target: links open where they are, and there is no rel to get wrong
        a: ['href'],
        img: ['src', 'alt', 'width', 'height'],
        div: ['data-video', 'data-telegram-post', 'data-youtube-video', 'data-poll'],
        iframe: ['src', 'width', 'height', 'allow', 'allowfullscreen', 'frameborder'],
        video: ['src', 'controls', 'width', 'height'],
    },
    allowedClasses: {
        div: ['telegram-embed', 'video-embed', 'poll-embed'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedIframeHostnames: EMBED_HOSTS,
    // inline style is decoration, and the Telegram embed's border-radius is not worth an attribute
    // that can carry url()
}

// media: the bucket's origin. A picture or video from anywhere else is dropped whole: the page's
// CSP would refuse it and leave a broken box. So is a data: picture pasted before the editor had
// uploads, and every one of them when there is no media origin.
export function sanitizeArticle(html: string, media: string | null): string {
    return sanitizeHtml(html, {
        ...OPTIONS,
        exclusiveFilter: (frame) => {
            // a frame from anywhere else has lost its src above and would stay as an empty box
            if (frame.tag === 'iframe') return !frame.attribs.src
            if (frame.tag === 'img' || frame.tag === 'video') {
                return media === null || originOf(frame.attribs.src) !== media
            }
            return false
        },
    })
}
