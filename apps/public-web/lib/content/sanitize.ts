import sanitizeHtml from 'sanitize-html'

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
        video: ['src', 'controls', 'width', 'height', 'poster'],
    },
    allowedClasses: {
        div: ['telegram-embed', 'video-embed', 'poll-embed'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedIframeHostnames: ['www.youtube.com', 'www.youtube-nocookie.com', 't.me'],
    // A frame from anywhere else loses its src above and would stay as an empty box. So does a
    // picture pasted into the editor before it had uploads: a data: URL, dropped with its scheme.
    exclusiveFilter: (frame) =>
        (frame.tag === 'iframe' || frame.tag === 'img') && !frame.attribs.src,
    // inline style is decoration, and the Telegram embed's border-radius is not worth an attribute
    // that can carry url()
}

export function sanitizeArticle(html: string): string {
    return sanitizeHtml(html, OPTIONS)
}
