import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ScriptEditor } from './ScriptEditor';

describe('ScriptEditor', () => {
    it('renders and handles interactions', () => {
        const onVariantNameChange = vi.fn();
        const onTestTextChange = vi.fn();
        const onResetTestText = vi.fn();
        const onSave = vi.fn();

        render(
            <ScriptEditor 
                variantName="Test Variant"
                onVariantNameChange={onVariantNameChange}
                testText="Sample script"
                onTestTextChange={onTestTextChange}
                onResetTestText={onResetTestText}
                onSave={onSave}
                isSaving={false}
            />
        );

        expect(screen.getByDisplayValue('Test Variant')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Sample script')).toBeInTheDocument();

        fireEvent.change(screen.getByPlaceholderText(/Variant name/i), { target: { value: 'New Name' } });
        expect(onVariantNameChange).toHaveBeenCalledWith('New Name');

        const textarea = screen.getByDisplayValue('Sample script');
        fireEvent.change(textarea, { target: { value: 'New script' } });
        expect(onTestTextChange).toHaveBeenCalledWith('New script');

        fireEvent.click(screen.getByText(/Reset to Default/i));
        expect(onResetTestText).toHaveBeenCalled();

        fireEvent.click(screen.getByText('Save Script'));
        expect(onSave).toHaveBeenCalled();
    });

    it('shows saving state', () => {
        render(
            <ScriptEditor 
                variantName=""
                onVariantNameChange={vi.fn()}
                testText=""
                onTestTextChange={vi.fn()}
                onResetTestText={vi.fn()}
                onSave={vi.fn()}
                isSaving={true}
            />
        );
        expect(screen.getByText(/Saving Changes/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Saving Changes/i })).toBeDisabled();
    });
});
