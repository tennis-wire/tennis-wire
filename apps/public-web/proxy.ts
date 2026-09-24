import { NextResponse } from 'next/server'

import { pagePolicy } from '@/lib/security/csp'

// Here and not in next.config.ts: the policy names the media and Keycloak hosts of the stand it
// runs on, and next.config headers are fixed at build time.
export function proxy() {
    const response = NextResponse.next()
    response.headers.set('Content-Security-Policy', pagePolicy())
    return response
}

// Pages only. Under /api the answers are JSON, and a proxy there would also make Next buffer
// every request body before the route handler sees it.
export const config = {
    matcher: ['/((?!api/|_next/static/|_next/image/|favicon.ico).*)'],
}
