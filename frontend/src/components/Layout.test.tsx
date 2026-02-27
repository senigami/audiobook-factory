import { render, screen } from '@testing-library/react'
import { Layout } from './Layout'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'

describe('Layout', () => {
    const defaultProps = {
        children: <div>Content</div>,
    }

    it('renders the correct branding text', () => {
        render(
            <MemoryRouter>
                <Layout {...defaultProps} />
            </MemoryRouter>
        )

        expect(screen.getByText(/AUDIOBOOK/i)).toBeTruthy()
        expect(screen.getByText(/STUDIO/i)).toBeTruthy()
        expect(screen.getByLabelText(/Audiobook Studio/i)).toBeTruthy()
    })

    it('renders navigation tabs', () => {
        render(
            <MemoryRouter>
                <Layout {...defaultProps} />
            </MemoryRouter>
        )

        expect(screen.getByText(/Voices/i)).toBeTruthy()
        expect(screen.getByText(/Queue/i)).toBeTruthy()
        expect(screen.getByText(/Library/i)).toBeTruthy()
    })
})
