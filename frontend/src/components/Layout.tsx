import { Mic, Zap, Library } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: any) => void;
  headerRight?: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children, activeTab, onTabChange, headerRight }) => {
  const navItems = [
    { id: 'voices', label: 'Voices', icon: Mic },
    { id: 'synthesis', label: 'Synthesis', icon: Zap },
    { id: 'library', label: 'Library', icon: Library },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100vw' }}>
      <header className="glass-panel" style={{
        height: 'var(--header-height, 72px)',
        width: '100%',
        position: 'fixed',
        top: 0,
        left: 0,
        borderRadius: 0,
        borderTop: 'none',
        borderLeft: 'none',
        borderRight: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 2.5rem',
        zIndex: 100,
        backgroundColor: 'rgba(10, 10, 12, 0.8)',
        backdropFilter: 'blur(40px)',
        borderBottom: '1px solid var(--border)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '3rem' }}>
          {/* Logo Section */}
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer' }}
            onClick={() => onTabChange('synthesis')}
          >
            <div style={{
              position: 'relative',
              width: '42px',
              height: '42px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <div style={{
                position: 'absolute',
                inset: '-8px',
                background: 'var(--accent)',
                borderRadius: '14px',
                opacity: 0.15,
                filter: 'blur(12px)'
              }} />
              <img
                src="/logo.png"
                alt="Audiobook Factory"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 4px 12px rgba(139, 92, 246, 0.3))',
                  zIndex: 1
                }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <h1 style={{
                fontSize: '1.1rem',
                fontWeight: 900,
                letterSpacing: '-0.03em',
                margin: 0,
                background: 'linear-gradient(to bottom, #fff, #94a3b8)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                lineHeight: 1
              }}>
                AUDIOBOOK
              </h1>
              <span style={{
                fontSize: '0.8rem',
                fontWeight: 800,
                color: 'var(--accent)',
                letterSpacing: '0.6em',
                textTransform: 'uppercase',
                opacity: 0.8,
                marginTop: '1px'
              }}>
                FACTORY
              </span>
            </div>
          </div>

          {/* Navigation Section */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={activeTab === item.id ? 'btn-primary' : 'btn-ghost'}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 18px',
                  borderRadius: '10px',
                  background: activeTab === item.id ? 'var(--accent)' : 'transparent',
                  boxShadow: activeTab === item.id ? '0 8px 20px var(--accent-glow)' : 'none',
                  color: activeTab === item.id ? 'white' : 'var(--text-secondary)',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
              >
                <item.icon size={16} opacity={activeTab === item.id ? 1 : 0.6} />
                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Global Controls Section */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          {headerRight}
        </div>
      </header>

      <main style={{
        flex: 1,
        marginTop: 'var(--header-height, 72px)',
        width: '100%',
        minHeight: 'calc(100vh - 72px)',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        padding: '2.5rem'
      }}>
        <div style={{ maxWidth: '1600px', width: '100%', margin: '0 auto' }}>
          {children}
        </div>
      </main>
    </div>
  );
};
