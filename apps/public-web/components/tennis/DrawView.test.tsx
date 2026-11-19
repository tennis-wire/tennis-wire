// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { finals, knockout } from '@/lib/tennis/fixtures'
import { entryName } from '@/lib/tennis/names'
import { matchesOf } from '@/lib/tennis/rounds'
import type { Draw } from '@/lib/tennis/types'

import DrawView from './DrawView'

afterEach(() => {
    cleanup()
    window.localStorage.clear()
})

const START = '2026-06-29T00:00:00Z'

const singles = (id: string, kind: Draw['kind'], seed: number): Draw => ({
    id,
    kind,
    qualifying: false,
    stages: [knockout({ seed, prefix: id, slots: 32, seeds: 8, bestOf: 3, upTo: 2, start: START })],
})

const headings = () => screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)

describe('DrawView', () => {
    it('names the draws by who plays them where men and women share the page', () => {
        render(<DrawView draws={[singles('ms', 'ms', 1), singles('ws', 'ws', 2)]} />)

        const draws = screen.getByRole('group', { name: 'Разряд' })
        expect(within(draws).getByRole('button', { name: 'Мужчины' })).toBeTruthy()
        expect(within(draws).getByRole('button', { name: 'Женщины' })).toBeTruthy()
    })

    it('says singles and doubles where one tour plays', () => {
        const doubles: Draw = { ...singles('md', 'md', 3), kind: 'md' }
        render(<DrawView draws={[singles('ms', 'ms', 1), doubles]} />)

        expect(screen.getByRole('button', { name: 'Одиночный' })).toBeTruthy()
        expect(screen.getByRole('button', { name: 'Парный' })).toBeTruthy()
    })

    it('opens on the round being played and moves to the one chosen', () => {
        render(<DrawView draws={[singles('ms', 'ms', 1)]} />)

        expect(headings()).toEqual(['1/8 финала', '1/4 финала', '1/2 финала'])
        expect(screen.getByText('LIVE')).toBeTruthy()

        fireEvent.click(screen.getByRole('button', { name: 'Финал' }))

        expect(headings()).toEqual(['Финал'])
    })

    it('shows the groups and then the playoff', () => {
        const draw: Draw = {
            id: 'ms',
            kind: 'ms',
            qualifying: false,
            stages: finals({ seed: 4, prefix: 'f', played: 1, start: START }),
        }
        render(<DrawView draws={[draw]} />)

        expect(screen.getByRole('heading', { level: 2, name: 'Групповой этап' })).toBeTruthy()
        expect(screen.getByRole('heading', { level: 2, name: 'Плей-офф' })).toBeTruthy()
        expect(screen.getAllByRole('table')).toHaveLength(2)
        expect(screen.getAllByText('1-й группы А').length).toBeGreaterThan(0)
    })

    describe('a reader building his own draw', () => {
        // The first round under way: some matches played, the rest to come
        const draw: Draw = {
            id: 'ms',
            kind: 'ms',
            qualifying: false,
            stages: [
                knockout({
                    seed: 6,
                    prefix: 'ms',
                    slots: 32,
                    seeds: 8,
                    bestOf: 3,
                    upTo: 1,
                    start: START,
                }),
            ],
        }
        const stage = draw.stages[0]
        if (stage.kind !== 'knockout') throw new Error('knockout expected')
        const open = matchesOf(stage, 1).find(
            (m) => m.status === 'scheduled' && m.a.kind === 'entry' && m.b.kind === 'entry'
        )
        if (!open || open.a.kind !== 'entry') throw new Error('an open match expected')
        const name = entryName(open.a.entry)

        it('is not offered without a key to keep it under', () => {
            render(<DrawView draws={[draw]} />)

            expect(screen.queryByRole('group', { name: 'Чья сетка' })).toBeNull()
        })

        it('sends the player tapped into the next round and keeps the choice', () => {
            render(<DrawView draws={[draw]} picksKey="test" />)
            fireEvent.click(screen.getByRole('button', { name: 'Мой прогноз' }))

            fireEvent.click(screen.getByRole('button', { name: new RegExp(name) }))

            expect(screen.getAllByText(name)).toHaveLength(2)
            expect(JSON.parse(window.localStorage.getItem('tw-picks:test:ms') ?? '{}')).toEqual({
                [open.id]: open.a.kind === 'entry' ? open.a.entry.id : '',
            })
        })

        it('leaves the real draw as it was', () => {
            render(<DrawView draws={[draw]} picksKey="test" />)
            fireEvent.click(screen.getByRole('button', { name: 'Мой прогноз' }))
            fireEvent.click(screen.getByRole('button', { name: new RegExp(name) }))

            fireEvent.click(screen.getByRole('button', { name: 'Как есть' }))

            expect(screen.getAllByText(name)).toHaveLength(1)
        })

        it('starts over on reset', () => {
            render(<DrawView draws={[draw]} picksKey="test" />)
            fireEvent.click(screen.getByRole('button', { name: 'Мой прогноз' }))
            fireEvent.click(screen.getByRole('button', { name: new RegExp(name) }))

            fireEvent.click(screen.getByRole('button', { name: 'Сбросить прогноз' }))

            expect(screen.getAllByText(name)).toHaveLength(1)
            expect(window.localStorage.getItem('tw-picks:test:ms')).toBeNull()
        })
    })
})
