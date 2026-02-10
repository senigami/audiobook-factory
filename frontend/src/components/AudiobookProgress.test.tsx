import { render, screen, act } from '@testing-library/react'
import { Sidebar } from './Sidebar'
import { Panel } from './Panel'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { Job } from '../types'

describe('Audiobook Progress Indicators', () => {
    const defaultSidebarProps = {
        onOpenAssembly: vi.fn(),
        piperVoices: [],
        audiobooks: [],
        paused: false,
        narratorOk: true,
        hideFinished: false,
        onToggleHideFinished: vi.fn(),
        onRefresh: vi.fn(),
    }

    const mockJob: Job = {
        id: 'test-job',
        engine: 'audiobook',
        chapter_file: 'Test Audiobook',
        status: 'running',
        created_at: Date.now() / 1000 - 60,
        started_at: Date.now() / 1000 - 30,
        progress: 0.1,
        eta_seconds: 100,
        safe_mode: false,
        make_mp3: false,
        warning_count: 0
    }

    beforeEach(() => {
        vi.useFakeTimers()
        // Setup a fixed "now" for test consistency
        vi.setSystemTime(new Date(Date.now()))
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    describe('Sidebar Audiobook Progress', () => {
        it('shows "Queued..." when job is queued', () => {
            const queuedJob = { ...mockJob, status: 'queued' as const, started_at: undefined }
            render(<Sidebar {...defaultSidebarProps} audiobookJob={queuedJob} />)

            expect(screen.getByText(/Queued.../i)).toBeTruthy()
            expect(screen.getByText(/Waiting.../i)).toBeTruthy()
        })

        it('shows "Assembling..." and local ETA countdown when running', () => {
            // Mock started_at to be 10 seconds ago, eta 100s total
            const startTime = Date.now() / 1000 - 10
            const runningJob = { ...mockJob, status: 'running' as const, started_at: startTime, eta_seconds: 100 }

            render(<Sidebar {...defaultSidebarProps} audiobookJob={runningJob} />)

            expect(screen.getByText(/Assembling.../i)).toBeTruthy()

            // Initial ETA should be around 90s (1:30)
            expect(screen.getByText(/ETA: 1:30/i)).toBeTruthy()

            // Advance time by 5 seconds
            act(() => {
                vi.advanceTimersByTime(5000)
            })

            // ETA should now be around 85s (1:25)
            expect(screen.getByText(/ETA: 1:25/i)).toBeTruthy()
        })

        it('calculates smooth progress locally if backend progress is low', () => {
            const startTime = Date.now() / 1000 - 50 // 50s elapsed
            const runningJob = { ...mockJob, status: 'running' as const, started_at: startTime, eta_seconds: 100, progress: 0.1 }

            const { container } = render(<Sidebar {...defaultSidebarProps} audiobookJob={runningJob} />)

            const progressBar = container.querySelector('.progress-bar-animated') as HTMLElement
            // 50s / 100s = 0.5 progress should be calculated locally as it's higher than 0.1
            expect(progressBar.style.width).toBe('50%')
        })
    })

    describe('Panel Progress Bar', () => {
        it('shows progress bar in Panel when running', () => {
            const startTime = Date.now() / 1000 - 20
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
            // Local progress 20/100 = 0.2, same as backend
            expect(progressBar.style.width).toBe('20%')

            expect(screen.getByText(/ETA: 1:20/i)).toBeTruthy()
        })

        it('updates Panel ETA and progress over time', () => {
            const startTime = Date.now() / 1000
            const { container } = render(
                <Panel
                    title="Consolidating Chapters"
                    filename="test.txt"
                    status="running"
                    progress={0.05}
                    startedAt={startTime}
                    etaSeconds={100}
                />
            )

            expect(screen.getByText(/ETA: 1:40/i)).toBeTruthy()

            // Advance 10 seconds
            act(() => {
                vi.advanceTimersByTime(10000)
            })

            // Need to trigger a re-render or wait for the internal timer to trigger it
            // Since Panel has a 1s setInterval, it should re-render itself
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
            // Should show the minimum 5% width even at 0 progress
            expect(progressBar.style.width).toBe('5%')
        })
    })
})
