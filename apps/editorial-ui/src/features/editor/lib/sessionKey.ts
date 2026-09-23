import type { Location } from 'react-router-dom'

// What the editor route is keyed by. Each visit gets its own key, so the editor
// remounts, except for a new article moving to its own address after the first save:
// that navigation carries the old key along, and the page, with whatever was typed
// meanwhile, stays as it is.
export function sessionKeyOf(location: Location): string {
    const continues = (location.state as { continues?: string } | null)?.continues
    return continues ?? location.key
}
