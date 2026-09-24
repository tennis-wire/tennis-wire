import type { BlockMode } from '@/lib/discussion/modes'

import { strings } from './strings'

// The mode an author is ignored in, readable without opening anything. Taking branches away is
// marked apart from the other two: it hides the reader's own replies as well.
export default function ModeBadge({ mode }: { mode: BlockMode }) {
    const severe = mode === 'subtree_removal'
    return (
        <span
            style={{
                fontSize: 12,
                fontWeight: 600,
                padding: '3px 9px',
                borderRadius: 12,
                whiteSpace: 'nowrap',
                background: severe ? 'var(--tw-live-bg)' : 'var(--tw-tag)',
                color: severe ? 'var(--tw-live)' : 'var(--tw-primary)',
            }}
        >
            {strings.modes[mode]}
        </span>
    )
}
