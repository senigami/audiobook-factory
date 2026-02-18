import { render, screen, fireEvent } from '@testing-library/react'
import { VoicesTab } from './VoicesTab'
import { describe, it, expect, vi } from 'vitest'

describe('VoicesTab', () => {
    const mockProfiles = [
        { name: 'Narrator1', wav_count: 5, speed: 1.0, is_default: false, preview_url: null },
        { name: 'Narrator2', wav_count: 3, speed: 1.2, is_default: true, preview_url: '/preview.wav' }
    ]

    const mockProps = {
        onRefresh: vi.fn(),
        speakerProfiles: mockProfiles,
        testProgress: {}
    }

    it('renders all narrator profiles', () => {
        render(<VoicesTab {...mockProps} />)
        expect(screen.getByText('Narrator1')).toBeInTheDocument()
        expect(screen.getByText('Narrator2')).toBeInTheDocument()
    })

    it('highlights the default narrator star', () => {
        render(<VoicesTab {...mockProps} />)
        // Narrator2 is default. The button should have "Default Narrator" title
        const defaultBtn = screen.getByTitle('Default Narrator')
        expect(defaultBtn).toBeInTheDocument()
    })

    it('calls fetch when setting a new default', async () => {
        const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ status: 'success' }) })
        global.fetch = fetchMock

        render(<VoicesTab {...mockProps} />)

        // Find the "Set as Default" button for Narrator1
        const setBtn = screen.getByTitle('Set as Default')
        fireEvent.click(setBtn)

        expect(fetchMock).toHaveBeenCalledWith('/api/settings/default-speaker', expect.anything())
    })
})
