import { describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { proxy } = vi.hoisted(() => ({
    proxy: vi.fn(async () => new Response(null, { status: 204 })),
}))
vi.mock('@/lib/gateway/proxy', () => ({ proxy }))

import * as route from './route'

describe('the article refs proxy route', () => {
    it('hands a GET on, bound to this one path', async () => {
        const request = new NextRequest('http://localhost:3000/api/public/articles/by-ids?ids=a,b')

        await route.GET(request)

        expect(proxy).toHaveBeenCalledWith(request, '/api/public/articles/by-ids')
    })

    // Next answers 405 for a method this file does not export
    it('takes reads only', () => {
        expect(Object.keys(route)).toEqual(['GET'])
    })
})
