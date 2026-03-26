export interface FontPair {
    name: string
    display: string
    displayUrl: string
    body: string
    bodyUrl: string
    description: string
}

export type FontPairIndex = 0 | 1 | 2

export const FONT_PAIRS: FontPair[] = [
    {
        name: 'Editorial Classic',
        display: "'DM Serif Display', serif",
        displayUrl:
            'https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&display=swap',
        body: "'Source Sans 3', sans-serif",
        bodyUrl:
            'https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@300;400;500;600;700&display=swap',
        description: 'Классика спортивной журналистики. Элегантные заголовки + читаемый текст.',
    },
    {
        name: 'Modern Bold',
        display: "'Outfit', sans-serif",
        displayUrl:
            'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&display=swap',
        body: "'IBM Plex Sans', sans-serif",
        bodyUrl:
            'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap',
        description: 'Современный, технологичный. Хорошо для live-данных и статистики.',
    },
    {
        name: 'Magazine Luxe',
        display: "'Playfair Display', serif",
        displayUrl:
            'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700;800;900&display=swap',
        body: "'Nunito Sans', sans-serif",
        bodyUrl:
            'https://fonts.googleapis.com/css2?family=Nunito+Sans:wght@300;400;500;600;700&display=swap',
        description: 'Журнальный стиль. Роскошные заголовки, мягкий основной текст.',
    },
]
