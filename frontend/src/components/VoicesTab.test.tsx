import { render, screen, fireEvent, act } from '@testing-library/react'
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

    it('opens edit modal and allows renaming', async () => {
        const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ status: 'success' }) })
        global.fetch = fetchMock

        render(<VoicesTab {...mockProps} />)

        // Open modal for Narrator1
        const editBtn = screen.getAllByTitle('Edit Sample Text')[0]
        fireEvent.click(editBtn)

        // Find name input and change it
        const nameInput = screen.getByDisplayValue('Narrator1')
        fireEvent.change(nameInput, { target: { value: 'Super Narrator' } })

        // Click Save Changes
        const saveBtn = screen.getByText('Save Changes')
        await act(async () => {
            fireEvent.click(saveBtn)
        })

        // Verify rename fetch call
        expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/speaker-profiles/Narrator1/rename'), expect.objectContaining({
            method: 'POST',
            body: expect.any(URLSearchParams)
        }))
    })
})
