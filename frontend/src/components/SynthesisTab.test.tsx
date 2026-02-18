import { render, screen } from '@testing-library/react'
import { SynthesisTab } from './SynthesisTab'
import { describe, it, expect, vi } from 'vitest'

describe('SynthesisTab', () => {
    const mockProps = {
        chapters: ['Chapter1.txt'],
        jobs: {},
        selectedFile: null,
        onSelect: vi.fn(),
        statusSets: { xttsMp3: [], xttsWav: [], piperMp3: [], piperWav: [] },
        onRefresh: vi.fn(),
        speakerProfiles: [],
        paused: false,
        settings: {},
        hideFinished: false,
        onToggleHideFinished: vi.fn(),
        onOpenPreview: vi.fn(),
    }

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

        // Note: SynthesisTab uses <select>, might need to find by display value or tag
        const selectEl = document.querySelector('select') as HTMLSelectElement
        expect(selectEl.value).toBe('DefaultGuy')
    })
})
