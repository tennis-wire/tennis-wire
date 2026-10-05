// Hosts whose frames an article may carry. The sanitizer drops any other iframe, and the page's
// CSP refuses to load one.
export const EMBED_HOSTS = ['www.youtube.com', 'www.youtube-nocookie.com', 't.me']

// What a screen reader announces for a frame, which otherwise is just "frame"
export function embedTitle(src: string | undefined): string {
    try {
        const host = new URL(src ?? '').hostname
        if (host === 't.me') return 'Пост в Telegram'
        if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
            return 'Видео YouTube'
        }
    } catch {
        // no address, no name for it
    }
    return 'Встроенный материал'
}
