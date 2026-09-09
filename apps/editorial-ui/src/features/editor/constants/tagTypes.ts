import type { TagType } from '../types/content.ts'

// Shown next to a tag name so that "Australian Open" the tournament and
// "Australian Open" the section are told apart in a dropdown.
export const TAG_TYPE_LABELS: Record<TagType, string> = {
    player: 'Игрок',
    tournament: 'Турнир',
    section: 'Раздел',
    topic: 'Тема',
}
