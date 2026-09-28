// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

import { createPoll, type Poll } from '../api/pollApi'
import { PollDialog } from './PollDialog'

// the real one pulls in the UserManager, which wants a browser
vi.mock('../api/pollApi', () => ({ createPoll: vi.fn() }))

const create = vi.mocked(createPoll)

const made: Poll = {
    id: 'p1',
    question: 'Who wins?',
    closesAt: null,
    closed: false,
    multipleChoice: false,
    voteCount: 0,
    options: [],
}

function openDialog() {
    const onInsert = vi.fn()
    render(<PollDialog open onClose={vi.fn()} onInsert={onInsert} />)
    fireEvent.change(screen.getByLabelText('Вопрос'), { target: { value: 'Who wins?' } })
    fireEvent.change(screen.getByPlaceholderText('Вариант 1'), { target: { value: 'Sinner' } })
    fireEvent.change(screen.getByPlaceholderText('Вариант 2'), { target: { value: 'Alcaraz' } })
    return onInsert
}

function insert() {
    fireEvent.click(screen.getByRole('button', { name: 'Вставить' }))
}

beforeEach(() => {
    create.mockReset()
    create.mockResolvedValue(made)
})

afterEach(cleanup)

describe('PollDialog', () => {
    it('makes an open-ended single-choice poll unless told otherwise', async () => {
        const onInsert = openDialog()

        insert()

        await waitFor(() => expect(onInsert).toHaveBeenCalledWith(made))
        expect(create).toHaveBeenCalledWith({
            question: 'Who wins?',
            options: ['Sinner', 'Alcaraz'],
            closesAt: null,
            multipleChoice: false,
        })
    })

    it('lets readers choose several when asked to', async () => {
        const onInsert = openDialog()

        fireEvent.click(screen.getByLabelText('Несколько ответов'))
        insert()

        await waitFor(() => expect(onInsert).toHaveBeenCalled())
        expect(create.mock.calls[0][0].multipleChoice).toBe(true)
    })

    it('offers a deadline in the future once one is asked for', async () => {
        const onInsert = openDialog()

        fireEvent.click(screen.getByRole('button', { name: 'До даты' }))
        insert()

        await waitFor(() => expect(onInsert).toHaveBeenCalled())
        const closesAt = create.mock.calls[0][0].closesAt
        expect(closesAt).not.toBeNull()
        expect(Date.parse(closesAt as string)).toBeGreaterThan(Date.now())
    })

    it('goes back to no deadline without leaving a date behind', async () => {
        const onInsert = openDialog()

        fireEvent.click(screen.getByRole('button', { name: 'До даты' }))
        fireEvent.click(screen.getByRole('button', { name: 'Без срока' }))
        insert()

        await waitFor(() => expect(onInsert).toHaveBeenCalled())
        expect(create.mock.calls[0][0].closesAt).toBeNull()
    })
})
