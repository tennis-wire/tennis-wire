import type { NextRequest } from 'next/server'

import { proxy } from '@/lib/gateway/proxy'

const PREFIX = '/api/users/'

export const GET = (request: NextRequest) => proxy(request, PREFIX)
export const POST = (request: NextRequest) => proxy(request, PREFIX)
export const PATCH = (request: NextRequest) => proxy(request, PREFIX)
export const DELETE = (request: NextRequest) => proxy(request, PREFIX)
