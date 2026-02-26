import { Mic, Zap, Library, Terminal } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: any) => void;
  headerRight?: React.ReactNode;
  showLogs?: boolean;
  onToggleLogs?: () => void;
  queueCount?: number;
}

export const Layout: React.FC<LayoutProps> = ({ children, activeTab, onTabChange, headerRight, showLogs, onToggleLogs, queueCount }) => {
  const navItems = [
    { id: 'library', label: 'Library', icon: Library },
    { id: 'queue', label: 'Queue', icon: Zap },
    { id: 'voices', label: 'Voices', icon: Mic },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100vw' }}>
      <header className="header-container" style={{
        height: 'var(--header-height, 72px)',
        width: '100%',
        position: 'fixed',
        top: 0,
        left: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 2.5rem',
        zIndex: 100,
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border)',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '3rem' }}>
          {/* Logo Section */}
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer' }}
            onClick={() => onTabChange('library-root')}
          >
            <div style={{
              position: 'relative',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <img
                src="/logo.png"
                alt="Audiobook Studio"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  zIndex: 1
                }}
              />
            </div>
            <div className="header-logo-text" style={{ display: 'flex', flexDirection: 'column' }}>
              <h1 style={{
                fontSize: '1.2rem',
                fontWeight: 800,
                letterSpacing: '-0.04em',
                margin: 0,
                color: 'var(--text-primary)',
                lineHeight: 1
              }}>
                Audiobook
              </h1>
              <span style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--accent)',
                letterSpacing: '0.35em',
                textTransform: 'uppercase',
                marginTop: '1px'
              }}>
                STUDIO
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
                  padding: '9px 18px',
                  borderRadius: '12px',
                  background: activeTab === item.id ? 'var(--accent)' : 'transparent',
                  color: activeTab === item.id ? 'white' : 'var(--text-secondary)',
                  transition: 'all 0.2s ease'
                }}
              >
                <item.icon size={16} opacity={activeTab === item.id ? 1 : 0.6} />
                <span className="nav-label" style={{ fontWeight: 600, fontSize: '0.9rem' }}>{item.label}</span>
                {item.id === 'queue' && queueCount !== undefined && queueCount > 0 && (
                   <div style={{ 
                       background: 'var(--accent)', color: 'white', borderRadius: '8px', 
                       padding: '2px 8px', fontSize: '0.7rem', fontWeight: 'bold', marginLeft: '4px' 
                   }}>{queueCount}</div>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Global Controls Section */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          {onToggleLogs && (
            <button
              onClick={onToggleLogs}
              className="btn-ghost"
              title={showLogs ? "Hide Console" : "Show Console"}
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                color: showLogs ? 'var(--accent)' : 'var(--text-muted)',
                background: showLogs ? 'var(--accent-glow)' : 'transparent',
                border: showLogs ? '1px solid var(--accent)' : '1px solid var(--border)',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0
              }}
            >
              <Terminal size={18} />
            </button>
          )}
          {headerRight}
        </div>
      </header>

      <main className="mobile-padding" style={{
        flex: 1,
        marginTop: 'var(--header-height, 72px)',
        width: '100%',
        minHeight: 'calc(100vh - 72px)',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        padding: '3rem 2.5rem'
      }}>
        <div style={{ maxWidth: '1600px', width: '100%', margin: '0 auto' }}>
          {children}
        </div>
      </main>
    </div>
  );
};
