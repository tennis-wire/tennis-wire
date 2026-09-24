import type { NextConfig } from 'next'

// Headers that do not depend on the stand. The CSP names hosts from runtime configuration,
// and this file is read at build time, so it is set in proxy.ts instead.
const SECURITY_HEADERS = [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]

const nextConfig: NextConfig = {
    poweredByHeader: false,
    async headers() {
        return [{ source: '/:path*', headers: SECURITY_HEADERS }]
    },
}

export default nextConfig
