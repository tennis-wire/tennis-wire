// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import ReactionTally from './ReactionTally'

afterEach(cleanup)

function names() {
    const list = screen.getByRole('list', { name: 'Реакции на комментарии' })
    return within(list)
        .getAllByRole('img')
        .map((item) => item.getAttribute('aria-label'))
}

describe('ReactionTally', () => {
    it('names each count by what it is', () => {
        render(
            <ReactionTally totals={{ likeCount: 12, dislikeCount: 3, emojiCounts: { clown: 1 } }} />
        )

        expect(names()).toEqual(['Нравится: 12', 'Не нравится: 3', 'Клоунада: 1'])
    })

    it('shows the votes at zero and no emoji nobody put', () => {
        render(<ReactionTally totals={{ likeCount: 0, dislikeCount: 0, emojiCounts: {} }} />)

        expect(names()).toEqual(['Нравится: 0', 'Не нравится: 0'])
    })
})
