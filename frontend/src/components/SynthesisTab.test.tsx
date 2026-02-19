import { render, screen, fireEvent, act } from '@testing-library/react'
import { SynthesisTab } from './SynthesisTab'
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('SynthesisTab', () => {
    const mockProps = {
        chapters: ['Chapter1.txt'],
        jobs: {},
        selectedFile: null,
        onSelect: vi.fn(),
        statusSets: { xttsMp3: [], xttsWav: [] },
        onRefresh: vi.fn(),
        speakerProfiles: [],
        paused: false,
        settings: { safe_mode: true, make_mp3: false },
        hideFinished: false,
        onToggleHideFinished: vi.fn(),
        onOpenPreview: vi.fn(),
    }

    beforeEach(() => {
        vi.clearAllMocks()
        // Mock fetch
        global.fetch = vi.fn().mockImplementation(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ status: 'success' }),
            })
        )
    })

    it('shows "No narrators found" when speakerProfiles is empty', () => {
        render(<SynthesisTab {...mockProps} speakerProfiles={[]} />)
        expect(screen.getByText(/No narrators found/i)).toBeInTheDocument()
    })

    it('shows "Select Narrator..." when speakerProfiles exist but no default is set', () => {
        const profiles = [{ name: 'Narrator1' }]
        render(<SynthesisTab {...mockProps} speakerProfiles={profiles} settings={{}} />)
        expect(screen.getByText(/Select Narrator.../i)).toBeInTheDocument()
    })

    it('pre-selects the default narrator from settings', () => {
        const profiles = [{ name: 'Narrator1' }, { name: 'DefaultGuy' }]
        const settings = { default_speaker_profile: 'DefaultGuy' }
        render(<SynthesisTab {...mockProps} speakerProfiles={profiles} settings={settings} />)

        const selectEl = document.querySelector('select') as HTMLSelectElement
        expect(selectEl.value).toBe('DefaultGuy')
    })

    it('opens settings overlay when clicking the gear icon', async () => {
        render(<SynthesisTab {...mockProps} />)

        const settingsBtn = screen.getByTitle(/Synthesis Settings/i)
        await act(async () => {
            fireEvent.click(settingsBtn)
        })

        expect(screen.getByText(/Synthesis Preferences/i)).toBeInTheDocument()
        expect(screen.getByText(/Safe Mode/i)).toBeInTheDocument()
        expect(screen.getByText(/Produce MP3/i)).toBeInTheDocument()
    })

    it('toggles Produce MP3 and calls the settings API', async () => {
        render(<SynthesisTab {...mockProps} />)

        // Open settings
        const settingsBtn = screen.getByTitle(/Synthesis Settings/i)
        await act(async () => {
            fireEvent.click(settingsBtn)
        })

        const mp3Toggle = screen.getByText(/Produce MP3/i).parentElement?.parentElement?.querySelector('button')
        expect(mp3Toggle).toBeTruthy()

        await act(async () => {
            fireEvent.click(mp3Toggle!)
        })

        expect(global.fetch).toHaveBeenCalledWith('/settings', expect.objectContaining({
            method: 'POST',
            body: expect.any(URLSearchParams)
        }))

        const body = (global.fetch as any).mock.calls[0][1].body as URLSearchParams
        expect(body.get('make_mp3')).toBe('true')
    })

    it('shows Reconcile Files ONLY when Produce MP3 is enabled', async () => {
        // First test with make_mp3: false
        const { rerender } = render(<SynthesisTab {...mockProps} settings={{ make_mp3: false }} />)

        await act(async () => {
            fireEvent.click(screen.getByTitle(/Synthesis Settings/i))
        })
        expect(screen.queryByText(/Reconcile Files/i)).not.toBeInTheDocument()

        // Rerender with make_mp3: true
        rerender(<SynthesisTab {...mockProps} settings={{ make_mp3: true }} />)
        expect(screen.getByText(/Reconcile Files/i)).toBeInTheDocument()
    })

    it('does NOT show "Global Speaking Speed" (deprecated)', async () => {
        render(<SynthesisTab {...mockProps} />)
        await act(async () => {
            fireEvent.click(screen.getByTitle(/Synthesis Settings/i))
        })

        expect(screen.queryByText(/Global Speaking Speed/i)).not.toBeInTheDocument()
        expect(screen.queryByRole('slider')).not.toBeInTheDocument()
    })
})
