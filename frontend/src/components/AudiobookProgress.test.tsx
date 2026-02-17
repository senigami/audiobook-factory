import { render, screen, act } from '@testing-library/react'
import { Panel } from './Panel'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

describe('Audiobook Progress Indicators', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date(1739800000000)) // Use a fixed timestamp for consistency
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    describe('Panel Progress Bar', () => {
        it('shows progress bar in Panel when running', () => {
            const startTime = 1739800000000 / 1000 - 20
            const { container } = render(
                <Panel
                    title="Consolidating Chapters"
                    filename="test.txt"
                    status="running"
                    progress={0.2}
                    startedAt={startTime}
                    etaSeconds={100}
                />
            )

            const progressBar = container.querySelector('.progress-bar-animated') as HTMLElement
            expect(progressBar).toBeTruthy()
            // Local calculation: 20s / 100s = 0.2. Matches backend 0.2.
            expect(progressBar.style.width).toBe('20%')

            expect(screen.getByText(/ETA: 1:20/i)).toBeTruthy()
        })

        it('updates Panel ETA and progress over time', () => {
            const startTime = 1739800000000 / 1000
            const { container } = render(
                <Panel
                    title="Consolidating Chapters"
                    filename="test.txt"
                    status="running"
                    progress={0}
                    startedAt={startTime}
                    etaSeconds={100}
                />
            )

            // Initial state
            expect(screen.getByText(/ETA: 1:40/i)).toBeTruthy()

            // Advance 10 seconds
            act(() => {
                vi.advanceTimersByTime(10000)
            })

            // Panel has an internal 1s timer that updates current 'now'
            // We need to wait for it or trigger a re-render. 
            // The Panel component uses its own internal state for 'now' if startedAt is provided.

            expect(screen.getByText(/ETA: 1:30/i)).toBeTruthy()
            const progressBar = container.querySelector('.progress-bar-animated') as HTMLElement
            expect(progressBar.style.width).toBe('10%')
        })

        it('shows progress bar in Panel when queued', () => {
            const { container } = render(
                <Panel
                    title="Waiting for engine..."
                    filename="test.txt"
                    status="queued"
                    progress={0}
                />
            )

            const progressBar = container.querySelector('.progress-bar-animated') as HTMLElement
            expect(progressBar).toBeTruthy()
            expect(progressBar.style.width).toBe('0%')
        })
    })
})
