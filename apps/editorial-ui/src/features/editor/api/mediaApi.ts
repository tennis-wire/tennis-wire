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

export function uploadErrorMessage(error: unknown): string {
    return error instanceof ImageUploadError ? error.message : 'Не удалось загрузить изображение'
}
