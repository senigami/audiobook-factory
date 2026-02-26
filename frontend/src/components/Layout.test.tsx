import { render, screen } from '@testing-library/react'
import { Layout } from './Layout'
import { describe, it, expect, vi } from 'vitest'

describe('Layout', () => {
    const defaultProps = {
        children: <div>Content</div>,
        activeTab: 'synthesis',
        onTabChange: vi.fn(),
    }

    it('renders the correct branding text', () => {
        render(<Layout {...defaultProps} />)

        expect(screen.getByText(/AUDIOBOOK/i)).toBeTruthy()
        expect(screen.getByText(/STUDIO/i)).toBeTruthy()
        expect(screen.getByAltText(/Audiobook Studio/i)).toBeTruthy()
    })

    it('renders navigation tabs', () => {
        render(<Layout {...defaultProps} />)

        expect(screen.getByText(/Voices/i)).toBeTruthy()
        expect(screen.getByText(/Queue/i)).toBeTruthy()
        expect(screen.getByText(/Library/i)).toBeTruthy()
        expect(screen.getByText(/Assembly/i)).toBeTruthy()
    })
})
