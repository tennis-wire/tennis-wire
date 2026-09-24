import { mediaOrigin } from '@/lib/security/csp'

// Once per server start. Without it nothing fails loudly: covers, pictures and avatars just stop
// showing, refused by the CSP.
export function register() {
    if (!mediaOrigin()) {
        console.warn(
            'MEDIA_ORIGIN is unset or not an http(s) URL: the CSP blocks every image and video from the media bucket'
        )
    }
}
