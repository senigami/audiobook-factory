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

    beforeEach(() => {
        vi.clearAllMocks()
        // Provide a default empty speakers array for all tests
        global.fetch = vi.fn((url: string) => {
            if (url === '/api/speakers') {
                return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
            }
            return Promise.resolve({ ok: true, json: () => Promise.resolve({ status: 'success' }) });
        }) as any
    })

    it('renders all narrator profiles', async () => {
        await act(async () => {
            render(<VoicesTab {...mockProps} />)
        })
        expect(screen.getByText('Narrator1')).toBeInTheDocument()
        expect(screen.getByText('Narrator2')).toBeInTheDocument()
    })

    it('shows the default narrator pill', async () => {
        await act(async () => {
            render(<VoicesTab {...mockProps} />)
        })
        // Narrator2 is default. Should have "Default" pill
        expect(screen.getByText('Default')).toBeInTheDocument()
    })

    it('calls fetch when setting a new default via ActionMenu', async () => {
        const fetchMock = vi.mocked(global.fetch)

        render(<VoicesTab {...mockProps} />)

        // Open ActionMenu for Narrator1
        const actionMenus = await screen.findAllByRole('button', { name: /more actions/i })
        fireEvent.click(actionMenus[0])

        // Find "Set as Default" in the menu
        const setBtn = await screen.findByText('Set as Default')
        await act(async () => {
            fireEvent.click(setBtn)
        })

        expect(fetchMock).toHaveBeenCalledWith('/api/settings/default-speaker', expect.anything())
    })

    it('opens edit modal and allows renaming via ActionMenu', async () => {
        const fetchMock = vi.mocked(global.fetch)

        render(<VoicesTab {...mockProps} />)

        // Open ActionMenu for Narrator1
        const actionMenus = await screen.findAllByRole('button', { name: /more actions/i })
        fireEvent.click(actionMenus[0])

        // Click Edit Script - wait for menu to appear
        const renameBtn = await screen.findByText('Edit Script')
        fireEvent.click(renameBtn)

        // Find name input and change it
        const nameInput = await screen.findByDisplayValue('Narrator1')
        fireEvent.change(nameInput, { target: { value: 'Super Narrator' } })

        // Click Save Configuration
        const saveBtn = await screen.findByText('Save Configuration')
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
