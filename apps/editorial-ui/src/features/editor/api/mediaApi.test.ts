import { beforeEach, describe, expect, it, vi } from 'vitest'

import { apiFetch } from '../../../api/apiFetch'
import { ImageUploadError, importImage, uploadErrorMessage, uploadImage } from './mediaApi'

// the real one pulls in the UserManager, which wants a browser
vi.mock('../../../api/apiFetch', () => ({ apiFetch: vi.fn() }))

const apiFetchMock = vi.mocked(apiFetch)

function file(type: string, bytes = 8): File {
    return new File([new Uint8Array(bytes)], 'cover', { type })
}

beforeEach(() => {
    apiFetchMock.mockReset()
})

describe('uploadImage', () => {
    it('sends the file as multipart and returns what the server stored', async () => {
        const stored = { id: '1', url: 'http://media.test/2026/09/a.png' }
        apiFetchMock.mockResolvedValue(Response.json(stored, { status: 201 }))
        const picture = file('image/png')

        await expect(uploadImage(picture)).resolves.toEqual(stored)

        const [path, init] = apiFetchMock.mock.calls[0]
        expect(path).toBe('/api/editorial/media/images')
        expect(init?.method).toBe('POST')
        expect((init?.body as FormData).get('file')).toBe(picture)
        // the browser writes the boundary into Content-Type itself
        expect(init?.headers).toBeUndefined()
    })

    it('refuses what the server would refuse without sending it', async () => {
        await expect(uploadImage(file('image/svg+xml'))).rejects.toBeInstanceOf(ImageUploadError)
        await expect(uploadImage(file('image/jpeg', 10 * 1024 * 1024 + 1))).rejects.toBeInstanceOf(
            ImageUploadError
        )

        expect(apiFetchMock).not.toHaveBeenCalled()
    })

    it('turns a refusal by the server into a message for the editor', async () => {
        apiFetchMock.mockResolvedValue(new Response(null, { status: 415 }))

        const error = await uploadImage(file('image/png')).catch((e: unknown) => e)

        expect(error).toBeInstanceOf(ImageUploadError)
        expect(uploadErrorMessage(error)).toContain('JPEG')
    })

    it('reports a request that never got an answer', async () => {
        apiFetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

        await expect(uploadImage(file('image/png'))).rejects.toBeInstanceOf(ImageUploadError)
    })
})

describe('importImage', () => {
    it('asks the server to copy the picture behind the link', async () => {
        const stored = { id: '1', url: 'http://media.test/2026/10/a.png' }
        apiFetchMock.mockResolvedValue(Response.json(stored, { status: 201 }))

        await expect(importImage('https://www.atptour.com/a.png')).resolves.toEqual(stored)

        const [path, init] = apiFetchMock.mock.calls[0]
        expect(path).toBe('/api/editorial/media/images/from-link')
        expect(JSON.parse(init?.body as string)).toEqual({ url: 'https://www.atptour.com/a.png' })
    })

    it('says in words why nothing came', async () => {
        apiFetchMock.mockResolvedValue(Response.json({ error: 'LINK_REFUSED' }, { status: 502 }))

        await expect(importImage('https://x.example/a.png')).rejects.toThrow(
            /Сайт не отдал картинку/
        )
    })

    it('falls back to the status for a code it does not know', async () => {
        apiFetchMock.mockResolvedValue(new Response('oops', { status: 500 }))

        await expect(importImage('https://x.example/a.png')).rejects.toThrow('(HTTP 500)')
    })
})
