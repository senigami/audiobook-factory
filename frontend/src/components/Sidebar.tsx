import React from 'react';
import { Play, Pause } from 'lucide-react';

interface SidebarProps {
  paused: boolean;
  onRefresh: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  paused,
  onRefresh
}) => {
  const handlePauseToggle = async () => {
    try {
      await fetch('/queue/pause', { method: 'POST' });
      onRefresh();
    } catch (e) {
      console.error('Failed to toggle pause', e);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <button
        onClick={handlePauseToggle}
        className="btn-glass"
        style={{ padding: '12px 16px', borderRadius: '12px', justifyContent: 'flex-start', border: '1px solid rgba(255,255,255,0.05)' }}
      >
        {paused ? <Play size={16} /> : <Pause size={16} />}
        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{paused ? 'Resume Processing' : 'Pause All Jobs'}</span>
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '0 8px' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: paused ? 'var(--warning)' : 'var(--success)', boxShadow: paused ? '0 0 10px var(--warning)' : '0 0 10px var(--success)' }}></div>
        <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)', opacity: 0.8 }}>
          {paused ? 'System Idle' : 'Monitoring Queue'}
        </span>
      </div>
    </div>
  );
};
