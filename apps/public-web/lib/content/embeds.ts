// Hosts whose frames an article may carry. The sanitizer drops any other iframe, and the page's
// CSP refuses to load one.
export const EMBED_HOSTS = ['www.youtube.com', 'www.youtube-nocookie.com', 't.me']
