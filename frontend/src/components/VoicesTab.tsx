import React, { useState, useEffect, useCallback } from 'react';
import { 
    Search, Plus, User, Info
} from 'lucide-react';
import type { Speaker, SpeakerProfile } from '../types';
import { GlassInput } from './GlassInput';
import { GhostButton } from './GhostButton';
import { ConfirmModal } from './ConfirmModal';
import { RecordingGuide } from './RecordingGuide';
import {
    NarratorCard,
    NewVoiceModal,
    RenameVoiceModal,
    AddVariantModal,
    MoveVariantModal,
    Drawer,
    ScriptEditor
} from './voices';






interface VoicesTabProps {
    onRefresh: () => void;
    speakerProfiles: SpeakerProfile[];
    testProgress: Record<string, { progress: number; started_at?: number }>;
}

export const VoicesTab: React.FC<VoicesTabProps> = ({ onRefresh, speakerProfiles, testProgress }) => {
    // --- State ---
    const [testingProfile, setTestingProfile] = useState<string | null>(null);
    const [editingProfile, setEditingProfile] = useState<SpeakerProfile | null>(null);
    const [testText, setTestText] = useState('');
    const [variantName, setVariantName] = useState('');
    const [isSavingText, setIsSavingText] = useState(false);
    const [showGuide, setShowGuide] = useState(false);
    const [confirmConfig, setConfirmConfig] = useState<{ 
        title: string; 
        message: string; 
        onConfirm: () => void; 
        isDestructive?: boolean;
        isAlert?: boolean;
    } | null>(null);
    
    // Sync state with editing profile
    useEffect(() => {
        if (editingProfile) {
            setTestText(editingProfile.test_text || '');
            setVariantName(editingProfile.variant_name || editingProfile.name);
        } else {
            setTestText('');
            setVariantName('');
        }
    }, [editingProfile]);

    // --- Voice Management State ---
    const [speakers, setSpeakers] = useState<Speaker[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isAddVariantModalOpen, setIsAddVariantModalOpen] = useState(false);
    const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
    const [renameSpeakerId, setRenameSpeakerId] = useState<string | null>(null);
    const [originalSpeakerName, setOriginalSpeakerName] = useState('');
    const [addVariantSpeaker, setAddVariantSpeaker] = useState<{ speaker: Speaker, nextVariantNum: number } | null>(null);
    const [newVoiceName, setNewVoiceName] = useState('');
    const [newSpeakerName, setNewSpeakerName] = useState('');
    const [newVariantNameModal, setNewVariantNameModal] = useState('');
    const [isCreatingVoice, setIsCreatingVoice] = useState(false);
    const [isAddingVariantModal, setIsAddingVariantModal] = useState(false);
    const [isRenamingSpeaker, setIsRenamingSpeaker] = useState(false);
    const [expandedVoiceId, setExpandedVoiceId] = useState<string | null>(null);
    const [isMoveVariantModalOpen, setIsMoveVariantModalOpen] = useState(false);
    const [moveVariantProfile, setMoveVariantProfile] = useState<SpeakerProfile | null>(null);
    const [selectedMoveSpeakerId, setSelectedMoveSpeakerId] = useState<string>('');
    const [isMovingVariant, setIsMovingVariant] = useState(false);
    const [buildingProfiles, setBuildingProfiles] = useState<Record<string, boolean>>({});

    const fetchSpeakers = useCallback(async () => {
        try {
            const resp = await fetch('/api/speakers');
            if (resp.ok) {
                const data = await resp.json();
                if (Array.isArray(data)) {
                    setSpeakers(data);
                }
            }
        } catch (e) {
            console.error('Failed to fetch speakers', e);
        }
    }, []);

    const handleSetDefault = async (profileName: string) => {
        try {
            const formData = new URLSearchParams();
            formData.append('name', profileName);
            const resp = await fetch('/api/settings/default-speaker', {
                method: 'POST',
                body: formData
            });
            if (resp.ok) {
                fetchSpeakers();
                onRefresh();
            }
        } catch (error) {
            console.error('Failed to set default voice:', error);
        }
    };

    const formatError = (err: any, fallback: string) => {
        if (!err) return fallback;
        if (err.message) return err.message;
        if (err.detail) {
            if (Array.isArray(err.detail)) {
                return err.detail.map((d: any) => d.msg || JSON.stringify(d)).join(', ');
            }
            return typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail);
        }
        return fallback;
    };

    useEffect(() => {
        fetchSpeakers();
    }, [fetchSpeakers, speakerProfiles]); // Also refresh when props change

    const handleRequestConfirm = (config: { title: string; message: string; onConfirm: () => void; isDestructive?: boolean; isAlert?: boolean }) => {
        setConfirmConfig(config);
    };

    const handleTest = useCallback(async (name: string) => {
        setTestingProfile(name);
        try {
            const resp = await fetch('/api/speaker-profiles/test', {
                method: 'POST',
                body: new URLSearchParams({ name }),
            });
            const result = await resp.json();
            if (result.status === 'success') {
                onRefresh();
            } else {
                handleRequestConfirm({
                    title: 'Test Failed',
                    message: formatError(result, 'An unknown error occurred during the test.'),
                    onConfirm: () => {},
                    isAlert: true
                });
            }
        } catch (err) {
            console.error('Test failed', err);
        } finally {
            setTestingProfile(null);
        }
    }, [onRefresh, handleRequestConfirm]);

    const handleBuildNow = useCallback(async (name: string, newFiles: File[], speakerId?: string, variantName?: string) => {
        setBuildingProfiles(prev => ({ ...prev, [name]: true }));
        const formData = new FormData();
        formData.append('name', name);
        if (speakerId) formData.append('speaker_id', speakerId);
        if (variantName) formData.append('variant_name', variantName);
        newFiles.forEach(f => formData.append('files', f));
        
        try {
            const resp = await fetch('/api/speaker-profiles/build', {
                method: 'POST',
                body: formData
            });
            if (resp.ok) {
                onRefresh();
                fetchSpeakers();
                // Automatically trigger a test after rebuild
                await handleTest(name);
                return true;
            } else {
                let errorMsg = 'An unknown error occurred during the rebuild process.';
                try {
                    const err = await resp.json();
                    errorMsg = formatError(err, errorMsg);
                } catch (e) {
                    console.error('Failed to parse error response', e);
                }
                
                handleRequestConfirm({
                    title: 'Rebuild Failed',
                    message: errorMsg,
                    onConfirm: () => {},
                    isAlert: true
                });
                return false;
            }
        } catch (e) {
            console.error('Rebuild failed', e);
            return false;
        } finally {
            setBuildingProfiles(prev => {
                const updated = { ...prev };
                delete updated[name];
                return updated;
            });
        }
    }, [onRefresh, fetchSpeakers, handleRequestConfirm, handleTest]);

    const handleSaveTestText = async () => {
        if (!editingProfile) return;
        setIsSavingText(true);
        try {
            const formData = new URLSearchParams();
            formData.append('text', testText);
            const resp = await fetch(`/api/speaker-profiles/${encodeURIComponent(editingProfile.name)}/test-text`, {
                method: 'POST',
                body: formData
            });
            
            if (resp.ok) {
                // Also handle name change if different
                const currentVariantDisplay = editingProfile.variant_name || editingProfile.name;
                if (variantName && variantName !== currentVariantDisplay) {
                    let newFullName = variantName;
                    if (editingProfile.speaker_id) {
                        const speaker = speakers.find(s => s.id === editingProfile.speaker_id);
                        if (speaker) {
                            newFullName = (variantName === 'Default' || variantName === speaker.name) ? speaker.name : `${speaker.name} - ${variantName}`;
                        }
                    }

                    const renameForm = new URLSearchParams();
                    renameForm.append('new_name', newFullName);
                    await fetch(`/api/speaker-profiles/${encodeURIComponent(editingProfile.name)}/rename`, {
                        method: 'POST',
                        body: renameForm
                    });
                }
                setEditingProfile(null);
                onRefresh();
            }
        } catch (e) {
            console.error('Failed to save profile', e);
        } finally {
            setIsSavingText(false);
        }
    };

    const handleResetTestText = async () => {
        if (!editingProfile) return;
        setIsSavingText(true);
        try {
            const resp = await fetch(`/api/speaker-profiles/${encodeURIComponent(editingProfile.name)}/reset-test-text`, {
                method: 'POST'
            });
            const result = await resp.json();
            if (result.status === 'success') {
                setTestText(result.test_text);
                onRefresh();
            }
        } catch (e) {
            console.error('Failed to reset test text', e);
        } finally {
            setIsSavingText(false);
        }
    };

    const handleDelete = async (name: string) => {
        try {
            const resp = await fetch(`/api/speaker-profiles/${encodeURIComponent(name)}`, {
                method: 'DELETE',
            });
            if (resp.ok) onRefresh();
        } catch (err) {
            console.error('Failed to delete profile', err);
        }
    };





    // --- Data Processing ---
    // Merge speakers and profiles into a unified Voice concept
    const voices = (speakers || []).map(speaker => {
        const pList = speakerProfiles.filter(p => p.speaker_id === speaker.id);
        // If no profiles, synthesize an initial "Default" profile to allow the user to add samples
        if (pList.length === 0) {
            pList.push({
                name: speaker.name,
                speaker_id: speaker.id,
                variant_name: 'Default',
                wav_count: 0,
                speed: 1.0,
                is_default: false,
                preview_url: null,
                wav_files: []
            } as SpeakerProfile);
        }
        return {
            id: speaker.id,
            name: speaker.name,
            profiles: pList
        };
    });

    // Identify profiles that aren't linked to any speaker
    const unassigned = speakerProfiles.filter(p => !p.speaker_id || !speakers.some(s => s.id === p.speaker_id));
    
    // Treat unassigned as standalone voices for now to bridge the transition
    const unassignedVoices = unassigned.map(p => ({
        id: `unassigned-${p.name}`,
        name: p.name,
        profiles: [p],
        isUnassigned: true
    }));

    const allVoices = [...voices, ...unassignedVoices];

    const filteredVoices = allVoices.filter(v => {
        const query = searchQuery.toLowerCase();
        return v.name.toLowerCase().includes(query) || 
               v.profiles.some(p => (p.variant_name || p.name).toLowerCase().includes(query));
    });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
            {/* Header with Search and New Voice Action */}
            <div style={{ 
                padding: '1.25rem 2rem', 
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'var(--surface-light)',
                zIndex: 10
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>Voices</h2>
                    
                    <div style={{ position: 'relative' }}>
                        <GlassInput
                            icon={<Search size={16} />}
                            placeholder="Search voices..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="search-responsive"
                            style={{
                                width: '240px',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                            }}
                            onFocus={(e) => {
                                e.currentTarget.style.width = '320px';
                            }}
                            onBlur={(e) => {
                                e.currentTarget.style.width = '240px';
                            }}
                        />
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <GhostButton 
                        onClick={() => setIsCreateModalOpen(true)} 
                        icon={Plus}
                        label="New Voice"
                    />
                    
                    <div className="mobile-hide" style={{ width: '1px', height: '24px', background: 'var(--border)', margin: '0 4px' }} />
                    
                    <GhostButton 
                        onClick={() => setShowGuide(true)} 
                        icon={Info}
                        label="Recording Guide"
                    />
                </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '2rem' }}>
                <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {allVoices.length === 0 ? (
                        <div style={{ 
                            padding: '60px', 
                            textAlign: 'center', 
                            background: 'rgba(var(--accent-rgb), 0.02)', 
                            borderRadius: '24px', 
                            border: '2px dashed var(--border)' 
                        }}>
                            <div style={{ 
                                width: '64px', 
                                height: '64px', 
                                borderRadius: '20px', 
                                background: 'var(--surface-alt)', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                margin: '0 auto 20px',
                                color: 'var(--text-muted)'
                            }}>
                                <User size={32} />
                            </div>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '8px' }}>No Voices Yet</h3>
                            <p style={{ color: 'var(--text-muted)', marginBottom: '24px', maxWidth: '300px', margin: '0 auto 24px' }}>
                                Create your first voice to start generating premium AI audio.
                            </p>
                            <button 
                                onClick={() => setIsCreateModalOpen(true)}
                                className="btn-primary" 
                                style={{ gap: '8px', padding: '0 24px', height: '44px', borderRadius: '12px' }}
                            >
                                <Plus size={20} />
                                Create New Voice
                            </button>
                        </div>
                    ) : filteredVoices.length === 0 ? (
                        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            <Search size={48} style={{ opacity: 0.2, marginBottom: '20px' }} />
                            <h3 style={{ margin: '0 0 10px', fontSize: '1.25rem' }}>No Matches Found</h3>
                            <p style={{ margin: 0 }}>Try adjusting your search query.</p>
                        </div>
                    ) : (
                        <>
                            {filteredVoices.map(voice => (
                                <NarratorCard
                                    key={voice.id}
                                    speaker={{ id: voice.id.startsWith('unassigned-') ? '' : voice.id, name: voice.name, default_profile_name: voice.profiles[0]?.name || null, created_at: 0, updated_at: 0 }}
                                    profiles={voice.profiles}
                                    onRefresh={onRefresh}
                                    onTest={handleTest}
                                    onDelete={handleDelete}
                                    onMoveVariant={(p) => {
                                        setMoveVariantProfile(p);
                                        setSelectedMoveSpeakerId('');
                                        setIsMoveVariantModalOpen(true);
                                    }}
                                    onEditTestText={(p) => setEditingProfile(p)}
                                    onBuildNow={handleBuildNow}
                                    isTestingProfileId={testingProfile}
                                    testProgress={testProgress}
                                    requestConfirm={handleRequestConfirm}
                                    buildingProfiles={buildingProfiles}
                                    onAddVariantClick={(s, count) => {
                                        setAddVariantSpeaker({ speaker: s, nextVariantNum: count + 1 });
                                        setNewVariantNameModal(`Variant ${count + 1}`);
                                        setIsAddVariantModalOpen(true);
                                    }}
                                    onSetDefaultClick={handleSetDefault}
                                    onRenameClick={(s) => {
                                        setRenameSpeakerId(s.id);
                                        setOriginalSpeakerName(s.name);
                                        setNewSpeakerName(s.name);
                                        setIsRenameModalOpen(true);
                                    }}
                                    isExpanded={expandedVoiceId === voice.id}
                                    onToggleExpand={() => setExpandedVoiceId(expandedVoiceId === voice.id ? null : voice.id)}
                                />
                            ))}
                        </>
                    )}
                </div>
            </div>

            <NewVoiceModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                value={newVoiceName}
                onChange={setNewVoiceName}
                onSubmit={async () => {
                    setIsCreatingVoice(true);
                    try {
                        const resp = await fetch('/api/speakers', {
                            method: 'POST',
                            body: new URLSearchParams({ name: newVoiceName.trim() })
                        });
                        if (resp.ok) {
                            const data = await resp.json();
                            setIsCreateModalOpen(false);
                            setNewVoiceName('');
                            await fetchSpeakers();
                            if (data.id) setExpandedVoiceId(data.id);
                        }
                    } finally {
                        setIsCreatingVoice(false);
                    }
                }}
                isCreating={isCreatingVoice}
            />

            <RenameVoiceModal
                isOpen={isRenameModalOpen}
                onClose={() => setIsRenameModalOpen(false)}
                originalName={originalSpeakerName}
                value={newSpeakerName}
                onChange={setNewSpeakerName}
                isRenaming={isRenamingSpeaker}
                onSubmit={async () => {
                    if (!renameSpeakerId) return;
                    setIsRenamingSpeaker(true);
                    try {
                        const formData = new URLSearchParams();
                        formData.append('id', renameSpeakerId);
                        formData.append('name', newSpeakerName.trim());
                        const resp = await fetch('/api/speakers', {
                            method: 'POST',
                            body: formData
                        });
                        if (resp.ok) {
                            setIsRenameModalOpen(false);
                            fetchSpeakers();
                        } else {
                            const err = await resp.json();
                            handleRequestConfirm({
                                title: 'Rename Failed',
                                message: formatError(err, 'An unknown error occurred while renaming the voice.'),
                                onConfirm: () => {},
                                isAlert: true
                            });
                        }
                    } finally {
                        setIsRenamingSpeaker(false);
                    }
                }}
            />

            <AddVariantModal
                isOpen={isAddVariantModalOpen}
                onClose={() => setIsAddVariantModalOpen(false)}
                speakerName={addVariantSpeaker?.speaker.name || ''}
                value={newVariantNameModal}
                onChange={setNewVariantNameModal}
                isAdding={isAddingVariantModal}
                onSubmit={async () => {
                    if (!addVariantSpeaker) return;
                    setIsAddingVariantModal(true);
                    try {
                        const formData = new URLSearchParams();
                        formData.append('speaker_id', addVariantSpeaker.speaker.id);
                        formData.append('variant_name', newVariantNameModal.trim());
                        const resp = await fetch('/api/speaker-profiles', {
                            method: 'POST',
                            body: formData
                        });
                        if (resp.ok) {
                            setIsAddVariantModalOpen(false);
                            setAddVariantSpeaker(null);
                            setNewVariantNameModal('');
                            onRefresh();
                        } else {
                            const err = await resp.json();
                            handleRequestConfirm({
                                title: 'Add Variant Failed',
                                message: formatError(err, 'An unknown error occurred while adding the variant.'),
                                onConfirm: () => {},
                                isAlert: true
                            });
                        }
                    } finally {
                        setIsAddingVariantModal(false);
                    }
                }}
            />

            <MoveVariantModal
                isOpen={isMoveVariantModalOpen}
                onClose={() => setIsMoveVariantModalOpen(false)}
                variantName={moveVariantProfile?.variant_name || moveVariantProfile?.name || ''}
                speakers={allVoices.filter(v => {
                    if (moveVariantProfile?.speaker_id && v.id === moveVariantProfile.speaker_id) return false;
                    if (!moveVariantProfile?.speaker_id && v.id === `unassigned-${moveVariantProfile?.name}`) return false;
                    return true;
                })}
                selectedSpeakerId={selectedMoveSpeakerId}
                onSelectSpeaker={setSelectedMoveSpeakerId}
                isMoving={isMovingVariant}
                onSubmit={async () => {
                    setIsMovingVariant(true);
                    try {
                        let targetSpeakerId = selectedMoveSpeakerId;
                        if (selectedMoveSpeakerId.startsWith('unassigned-')) {
                            const targetProfileName = selectedMoveSpeakerId.replace('unassigned-', '');
                            const targetVoiceEntry = allVoices.find(v => v.id === selectedMoveSpeakerId);
                            if (targetVoiceEntry) {
                                const createResp = await fetch('/api/speakers', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                                    body: new URLSearchParams({ name: targetVoiceEntry.name })
                                });
                                if (!createResp.ok) throw new Error('Failed to create speaker for target group');
                                const newSpeaker = await createResp.json();
                                targetSpeakerId = newSpeaker.id;
                                const assignProfileFormData = new URLSearchParams();
                                assignProfileFormData.append('speaker_id', targetSpeakerId);
                                assignProfileFormData.append('variant_name', 'Default');
                                await fetch(`/api/speaker-profiles/${encodeURIComponent(targetProfileName)}/assign`, {
                                    method: 'POST',
                                    body: assignProfileFormData
                                });
                            }
                        }
                        const formData = new URLSearchParams();
                        formData.append('speaker_id', targetSpeakerId);
                        if (moveVariantProfile) formData.append('variant_name', moveVariantProfile.variant_name || 'Default');
                        const resp = await fetch(`/api/speaker-profiles/${encodeURIComponent(moveVariantProfile?.name || '')}/assign`, {
                            method: 'POST',
                            body: formData
                        });
                        if (resp.ok) {
                            setIsMoveVariantModalOpen(false);
                            setMoveVariantProfile(null);
                            onRefresh();
                            fetchSpeakers();
                        } else {
                            const err = await resp.json();
                            handleRequestConfirm({
                                title: 'Move Failed',
                                message: formatError(err, 'An unknown error occurred while moving the variant.'),
                                onConfirm: () => {},
                                isAlert: true
                            });
                        }
                    } catch (err: any) {
                        handleRequestConfirm({
                            title: 'Move Failed',
                            message: err.message || 'An error occurred during movement.',
                            onConfirm: () => {},
                            isAlert: true
                        });
                    } finally {
                        setIsMovingVariant(false);
                    }
                }}
            />

            {/* Recording Guide Drawer */}
            <Drawer 
                isOpen={showGuide} 
                onClose={() => setShowGuide(false)} 
                title="Recording Guide"
            >
                <RecordingGuide />
            </Drawer>

            <Drawer
                isOpen={!!editingProfile}
                onClose={() => setEditingProfile(null)}
                title={`Edit: ${editingProfile?.variant_name || editingProfile?.name || ''}`}
            >
                <ScriptEditor
                    variantName={variantName}
                    onVariantNameChange={setVariantName}
                    testText={testText}
                    onTestTextChange={setTestText}
                    onResetTestText={handleResetTestText}
                    onSave={handleSaveTestText}
                    isSaving={isSavingText}
                />
            </Drawer>

            {/* Global Confirm Modal */}
            <ConfirmModal
                isOpen={!!confirmConfig}
                title={confirmConfig?.title || ''}
                message={confirmConfig?.message || ''}
                isDestructive={confirmConfig?.isDestructive}
                isAlert={confirmConfig?.isAlert}
                onConfirm={() => {
                    confirmConfig?.onConfirm();
                    setConfirmConfig(null);
                }}
                onCancel={() => setConfirmConfig(null)}
            />
        </div>
    );
};
