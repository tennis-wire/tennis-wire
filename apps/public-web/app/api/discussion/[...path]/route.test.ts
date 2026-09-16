import { describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { proxy } = vi.hoisted(() => ({
    proxy: vi.fn(async () => new Response(null, { status: 204 })),
}))
vi.mock('@/lib/gateway/proxy', () => ({ proxy }))

import * as route from './route'

describe('the discussion proxy route', () => {
    // Next answers 405 for a method this file does not export, before the proxy sees anything
    it.each(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const)('hands %s on', async (method) => {
        const request = new NextRequest('http://localhost:3000/api/discussion/blocks/1', { method })

        await route[method](request)

        expect(proxy).toHaveBeenCalledWith(request, '/api/discussion/')
    })
})
