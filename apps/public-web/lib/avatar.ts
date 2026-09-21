// The crop the cabinet uploads. The server decodes and re-encodes it anyway, so all this has to be
// is small and upright.

export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
// The server's floor, and its largest size twice over
export const MIN_SIDE = 96
export const MAX_SIDE = 576
// The browser decodes the whole source before anything is cropped from it
export const MAX_SOURCE_BYTES = 25 * 1024 * 1024

export type Area = { x: number; y: number; width: number; height: number }

export function refuseSource(file: { type: string; size: number }): string | null {
    if (!ACCEPTED_TYPES.includes(file.type)) return 'Подойдёт JPEG, PNG или WebP'
    if (file.size > MAX_SOURCE_BYTES) return 'Файл больше 25 МБ'
    return null
}

// Never scaled up: a small crop goes as it is
export function outputSide(area: Area): number {
    return Math.min(Math.round(area.width), MAX_SIDE)
}

export function refuseCrop(area: Area): string | null {
    return outputSide(area) < MIN_SIDE ? 'Выделите область побольше' : null
}

// code: `error` from user-service, `code` from this app's own proxy
export function uploadError(status: number, code?: string): string {
    if (status === 401) return 'Сессия истекла, войдите снова'
    if (status === 413) return 'Файл слишком большой'
    if (status === 429) return 'Слишком часто, попробуйте через минуту'
    if (status === 422 && code === 'IMAGE_TOO_SMALL') return 'Слишком маленький снимок'
    if (status === 422 && code === 'IMAGE_TOO_LARGE') return 'Слишком большой снимок'
    if (status === 422) return 'Не удалось прочитать изображение'
    return 'Не удалось сохранить, попробуйте ещё раз'
}
