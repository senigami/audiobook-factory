import { renderHook, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { useInitialData } from './useInitialData'

describe('useInitialData', () => {
    beforeEach(() => {
        global.fetch = vi.fn().mockResolvedValue({
            json: () => Promise.resolve({
                audiobooks: [{ filename: '1', title: 'ab1', cover_url: null }],
                speaker_profiles: [{ name: 'voice1' }],
                paused: true
            })
        }) as any
    })

    it('fetches initial data', async () => {
        const { result } = renderHook(() => useInitialData())
        
        expect(result.current.loading).toBe(true)

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        expect(result.current.data?.audiobooks.length).toBe(1)
        expect(result.current.data?.speaker_profiles.length).toBe(1)
        expect(result.current.data?.paused).toBe(true)
    })
})
