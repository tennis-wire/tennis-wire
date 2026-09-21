import type { NextRequest } from 'next/server'

import { proxy } from '@/lib/gateway/proxy'

// This one path and not /api/public/**: the rest of the public API is read on the server
export const GET = (request: NextRequest) => proxy(request, '/api/public/articles/by-ids')
