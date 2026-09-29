import type { CreditKind } from '../types/content'

// The word before a picture's credit, as the site writes it: "Фото: Getty Images"
export const CREDIT_KIND_LABELS: Record<CreditKind, string> = {
    photo: 'Фото',
    illustration: 'Иллюстрация',
    screenshot: 'Скриншот',
}
