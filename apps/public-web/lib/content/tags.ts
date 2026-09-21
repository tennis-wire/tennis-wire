export type TagType = 'player' | 'tournament' | 'organization' | 'topic' | 'section'

export type Tag = {
    id: string
    name: string
    slug: string
    type: TagType
}

// A section is a rubric with a page of its own; every other tag lists what carries it
export function tagHref(tag: Pick<Tag, 'slug' | 'type'>): string {
    const slug = encodeURIComponent(tag.slug)
    return tag.type === 'section' ? `/sections/${slug}` : `/tags/${slug}`
}
