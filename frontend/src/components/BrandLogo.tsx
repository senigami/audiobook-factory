import React from 'react';

interface BrandLogoProps {
  /**
   * Optional scale factor to resize the entire wordmark.
   */
  scale?: number;
  className?: string;
  /**
   * Whether to show the pictorial logo icon next to the wordmark.
   */
  showIcon?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ scale = 1, className = '', showIcon = false }) => {
  const style = {
    '--as-title-fs': scale !== 1 ? `calc(clamp(32px, 4vw, 64px) * ${scale})` : undefined,
    '--as-sub-fs': scale !== 1 ? `calc(clamp(14px, 1.2vw, 18px) * ${scale})` : undefined,
    display: 'flex',
    alignItems: 'center',
    gap: `${16 * scale}px`
  } as React.CSSProperties;

  return (
    <div 
      className={`as-wordmark ${className}`} 
      aria-label="Audiobook Studio"
      style={style}
    >
      {showIcon && (
        <div style={{ 
          height: `${80 * scale}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          <img 
            src="/logo-simple.png" 
            alt="" 
            style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
          />
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="as-title">Audiobook</div>
        <div className="as-subline">
          <span className="as-rule as-rule-left"></span>
          <span className="as-sub">STUDIO</span>
          <span className="as-rule as-rule-right"></span>
        </div>
      </div>
    </div>
  );
};
