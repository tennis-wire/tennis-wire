import type { MetadataRoute } from 'next'

import { appOrigin } from '@/lib/auth/config'

// Drawn per request, not at build: the address of this site is configuration of the stand
export const dynamic = 'force-dynamic'

// The cabinet and the proxies are nothing to index. Readers' pages are not closed here: they
// carry noindex, and a crawler kept out would never read it.
export default function robots(): MetadataRoute.Robots {
    return {
        rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/me'] },
        sitemap: `${appOrigin()}/sitemap.xml`,
    }
}
