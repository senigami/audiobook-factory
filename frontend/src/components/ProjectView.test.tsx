import { render, screen, waitFor } from '@testing-library/react'
import { ProjectView } from './ProjectView'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { api } from '../api'

vi.mock('../api')

describe('ProjectView', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    const defaultProject = {
        id: '1',
        name: 'Test Project',
        series: null,
        author: 'Test Author',
        cover_image_path: null,
        created_at: 1000,
        updated_at: 2000
    }

    it('renders project details and fetches chapters', async () => {
        vi.mocked(api.fetchProject).mockResolvedValue(defaultProject)
        vi.mocked(api.fetchChapters).mockResolvedValue([
            {
                id: 'ch-1',
                project_id: '1',
                title: 'Chapter 1',
                text_content: 'Test content',
                sort_order: 1,
                audio_status: 'unprocessed',
                audio_file_path: null,
                text_last_modified: null,
                audio_generated_at: null,
                char_count: 100,
                word_count: 20,
                sent_count: 2,
                predicted_audio_length: 10,
                audio_length_seconds: 0
            }
        ])

        render(<ProjectView projectId="1" jobs={{}} speakerProfiles={[]} onBack={vi.fn()} onNavigateToQueue={vi.fn()} onOpenPreview={vi.fn()} />)

        await waitFor(() => {
            expect(screen.getByText('Test Project')).toBeTruthy()
        })


        await waitFor(() => {
            expect(screen.getByText('Chapter 1')).toBeTruthy()
        })
    })
})
