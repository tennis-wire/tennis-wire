import type { CreditKind } from './articles'

export const CREDIT_LABEL: Record<CreditKind, string> = {
    photo: 'Фото',
    illustration: 'Иллюстрация',
    screenshot: 'Скриншот',
}

// The editor writes a credit without its word, naming only the kind: the word is the site's, and
// on the English site it will be another. Run over sanitized html, where the attribute is written
// exactly this way and can hold no other value.
const CREDIT = /<span data-credit="(photo|illustration|screenshot)">/g

export function labelCredits(html: string): string {
    return html.replace(CREDIT, (tag, kind: CreditKind) => `${tag}${CREDIT_LABEL[kind]}: `)
}
