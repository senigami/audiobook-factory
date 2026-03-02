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
        
        // Expand card to see variant tabs
        const voiceHeader = screen.getByText('Narrator2')
        fireEvent.click(voiceHeader)
        
        expect(screen.getByText('Default')).toBeInTheDocument()
    })


    it('opens profile details and allows building voice', async () => {

        render(<VoicesTab {...mockProps} />)

        // Find the Voice card (it mocks unassigned names as the voice name)
        const voiceHeader = screen.getByText('Narrator1')
        fireEvent.click(voiceHeader)

        // Now "Edit Script" or "Build Voice" should be visible in expanded view
        const buildBtn = await screen.findByText(/Rebuild/i)
        expect(buildBtn).toBeInTheDocument()
    })

    it('shows delete option in ActionMenu', async () => {
        render(<VoicesTab {...mockProps} />)

        // Open Voice ActionMenu
        const actionMenus = await screen.findAllByRole('button', { name: /more actions/i })
        fireEvent.click(actionMenus[0])

        expect(screen.getByText('Delete Voice')).toBeInTheDocument()
    })
})
