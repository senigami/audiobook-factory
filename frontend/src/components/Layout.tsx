import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children, sidebar }) => {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100vw' }}>
      <aside className="glass-panel" style={{
        width: 'var(--sidebar-width)',
        height: '100vh',
        position: 'fixed',
        left: 0,
        top: 0,
        borderRadius: 0,
        borderLeft: 'none',
        borderTop: 'none',
        borderBottom: 'none',
        display: 'flex',
        flexDirection: 'column',
        padding: '1.5rem',
        zIndex: 10
      }}>
        {sidebar || (
          <div>
            <h1 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Audiobook Factory</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Local Speech Synthesis</p>
          </div>
        )}
      </aside>
      
      <main style={{
        flex: 1,
        marginLeft: 'var(--sidebar-width)',
        minHeight: '100vh',
        position: 'relative',
        minWidth: 0,
        maxWidth: 'calc(100vw - var(--sidebar-width))'
      }}>
        {children}
      </main>
    </div>
  );
};
