import sanitizeHtml from 'sanitize-html'

import { originOf } from '@/lib/security/csp'

import { EMBED_HOSTS, embedTitle } from './embeds'

// What the editor emits (editorial-ui: TipTap StarterKit, its figure, Youtube and the embeds of
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
        'span',
        'div',
        'iframe',
        'video',
    ],
    allowedAttributes: {
        // no target: links open where they are, and there is no rel to get wrong
        a: ['href'],
        // loading and decoding are set below, whatever the editor wrote
        img: ['src', 'alt', 'width', 'height', 'loading', 'decoding'],
        // a figure's caption and credit; credits.ts words the credit by its kind
        span: [
            'data-caption',
            {
                name: 'data-credit',
                multiple: false,
                values: ['photo', 'illustration', 'screenshot'],
            },
        ],
        div: ['data-video', 'data-telegram-post', 'data-youtube-video', 'data-poll'],
        iframe: [
            'src',
            'width',
            'height',
            'allow',
            'allowfullscreen',
            'frameborder',
            'loading',
            'title',
        ],
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
//
// Pictures and frames load as the reader scrolls near them, not all at once with the page: a
// YouTube player alone is half a megabyte or more, for a video the reader may never reach. The
// first picture is the exception: with no cover it is what the page is about, the first thing
// seen, and waiting for the scroll would only make it late.
export function sanitizeArticle(html: string, media: string | null): string {
    let pictures = 0
    return sanitizeHtml(html, {
        ...OPTIONS,
        transformTags: {
            // whatever loading the editor wrote gives way to the order here
            img: (tagName, attribs) => {
                const next: sanitizeHtml.Attributes = { ...attribs, decoding: 'async' }
                delete next.loading
                if (pictures++ > 0) next.loading = 'lazy'
                return { tagName, attribs: next }
            },
            iframe: (tagName, attribs) => ({
                tagName,
                attribs: { ...attribs, loading: 'lazy', title: embedTitle(attribs.src) },
            }),
        },
        exclusiveFilter: (frame) => {
            // a frame from anywhere else has lost its src above and would stay as an empty box
            if (frame.tag === 'iframe') return !frame.attribs.src
            // a caption under a picture that was dropped would caption nothing
            if (frame.tag === 'figure') return !frame.mediaChildren.includes('img')
            if (frame.tag === 'img' || frame.tag === 'video') {
                return media === null || originOf(frame.attribs.src) !== media
            }
            return false
        },
    })
}
