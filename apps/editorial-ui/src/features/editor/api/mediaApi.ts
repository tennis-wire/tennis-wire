import { apiFetch } from '../../../api/apiFetch'

export interface UploadedImage {
    id: string
    url: string
    mimeType: string
    sizeBytes: number
    width: number
    height: number
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_BYTES = 10 * 1024 * 1024

export const IMAGE_ACCEPT = ACCEPTED_TYPES.join(',')

const WRONG_TYPE = 'Подходят только JPEG, PNG, WebP и GIF'
const TOO_LARGE = 'Файл больше 10 МБ'

// Thrown with a message that can be shown to the editor as it is
export class ImageUploadError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'ImageUploadError'
    }
}

// The server decides from the bytes; this only saves sending ten megabytes to hear "no"
function refusal(file: File): string | null {
    if (!ACCEPTED_TYPES.includes(file.type)) return WRONG_TYPE
    if (file.size > MAX_BYTES) return TOO_LARGE
    return null
}

function messageFor(status: number): string {
    if (status === 413) return TOO_LARGE
    if (status === 415) return WRONG_TYPE
    if (status === 503) return 'Хранилище файлов недоступно, попробуйте позже'
    return `Не удалось загрузить изображение (HTTP ${status})`
}

export async function uploadImage(file: File): Promise<UploadedImage> {
    const refused = refusal(file)
    if (refused !== null) throw new ImageUploadError(refused)

    const formData = new FormData()
    formData.append('file', file)

    let response: Response
    try {
        response = await apiFetch('/api/editorial/media/images', { method: 'POST', body: formData })
    } catch {
        throw new ImageUploadError('Не удалось загрузить изображение: нет связи с сервером')
    }
    if (!response.ok) throw new ImageUploadError(messageFor(response.status))
    return response.json()
}

// What the server says when it could not take a picture from a link, see content-service's
// RemoteImageFetcher; the code is the server's, the words are ours
const LINK_REFUSALS: Record<string, string> = {
    BAD_LINK: 'Нужна ссылка вида https://…',
    LOCAL_ADDRESS: 'По этой ссылке не скачать: адрес не в интернете',
    LINK_UNREACHABLE: 'Сайт не ответил. Проверьте ссылку или попробуйте позже',
    LINK_REFUSED: 'Сайт не отдал картинку: ссылка битая или скачивать оттуда нельзя',
    LINK_TOO_LARGE: 'Картинка больше 10 МБ',
    UNSUPPORTED_IMAGE: 'По ссылке не картинка: подходят JPEG, PNG, WebP и GIF',
    STORAGE_UNAVAILABLE: 'Хранилище файлов недоступно, попробуйте позже',
}

async function codeOf(response: Response): Promise<string | undefined> {
    try {
        return ((await response.json()) as { error?: string }).error
    } catch {
        return undefined
    }
}

// The server downloads the picture into the bucket and answers as for an upload
export async function importImage(url: string): Promise<UploadedImage> {
    let response: Response
    try {
        response = await apiFetch('/api/editorial/media/images/from-link', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url }),
        })
    } catch {
        throw new ImageUploadError('Не удалось скопировать картинку: нет связи с сервером')
    }
    if (!response.ok) {
        const code = await codeOf(response)
        throw new ImageUploadError(
            (code && LINK_REFUSALS[code]) ||
                `Не удалось скопировать картинку (HTTP ${response.status})`
        )
    }
    return response.json()
}

export function uploadErrorMessage(error: unknown): string {
    return error instanceof ImageUploadError ? error.message : 'Не удалось загрузить изображение'
}
