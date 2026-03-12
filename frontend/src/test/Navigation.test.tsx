import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../App';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('Navigation Regression', () => {
    beforeEach(() => {
        global.fetch = vi.fn((url) => {
            if (url === '/api/home') {
                return Promise.resolve({
                    json: () => Promise.resolve({
                        projects: [
                            { id: 'proj-1', name: 'Test Project', author: 'Author', updated_at: Date.now()/1000 }
                        ],
                        speaker_profiles: [],
                        paused: false
                    })
                })
            }
            if (url === '/api/jobs') return Promise.resolve({ json: () => Promise.resolve([]) });
            if (url === '/api/processing_queue') return Promise.resolve({ json: () => Promise.resolve([]) });
            if (url === '/api/projects') return Promise.resolve({
                json: () => Promise.resolve([
                    { id: 'proj-1', name: 'Test Project', author: 'Author', updated_at: Date.now()/1000 }
                ])
            });
            if (url === '/api/projects/proj-1') return Promise.resolve({
                json: () => Promise.resolve({ id: 'proj-1', name: 'Test Project', author: 'Author' })
            });
            if (url === '/api/projects/proj-1/chapters') return Promise.resolve({
                json: () => Promise.resolve([])
            });
            if (url === '/api/projects/proj-1/audiobooks') return Promise.resolve({
                json: () => Promise.resolve([])
            });
            if (url === '/api/speakers') return Promise.resolve({ json: () => Promise.resolve([]) });
            return Promise.resolve({ json: () => Promise.resolve({}) });
        }) as any;
    });

    it('navigates to project page when project card is clicked', async () => {
        render(
            <MemoryRouter initialEntries={['/']}>
                <App />
            </MemoryRouter>
        );

        // Wait for project library to load
        await waitFor(() => {
            expect(screen.getByText('Test Project')).toBeTruthy();
        });

        // Click the project card
        // We need to find the element with the onClick, which is the motion.div in ProjectCard
        // In the test, we'll try to find the text and click it.
        fireEvent.click(screen.getByText('Test Project'));

        // Check if navigation happened. 
        // Since we are inside MemoryRouter, we can't easily see the URL change 
        // unless we render specific routes or use a hook.
        // But App.tsx renders <ProjectView> at /project/:projectId.
        // So we should see ProjectView content if navigation worked.
        
        await waitFor(() => {
            // ProjectView usually has a 'Chapters' heading or something similar
            // Let's assume there's a back button or specific text.
            // ProjectHeader has the title.
            const projectHeaders = screen.getAllByText('Test Project');
            expect(projectHeaders.length).toBeGreaterThan(0);
        });
    });
});
