import { emojiTallied } from '@/lib/discussion/reactions'
import type { ReactionTotals } from '@/lib/discussion/types'

import { strings } from './strings'

const list: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px 14px',
    listStyle: 'none',
    padding: 0,
    margin: 0,
    fontSize: 14,
    color: 'var(--tw-text-secondary)',
}

// The likes and dislikes always, zero included; an emoji only once somebody put one
export default function ReactionTally({
    totals,
    style,
}: {
    totals: ReactionTotals
    style?: React.CSSProperties
}) {
    const items = [
        { key: 'like', glyph: '👍', label: strings.like, count: totals.likeCount },
        { key: 'dislike', glyph: '👎', label: strings.dislike, count: totals.dislikeCount },
        ...emojiTallied(totals),
    ]
    return (
        <ul aria-label={strings.reactionTally} style={{ ...list, ...style }}>
            {items.map(({ key, glyph, label, count }) => (
                <li key={key}>
                    {/* img: read out as the label and the number, not as the glyph's own name */}
                    <span role="img" aria-label={strings.reactionCount(label, count)}>
                        {glyph} {count}
                    </span>
                </li>
            ))}
        </ul>
    )
}
