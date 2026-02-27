import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MoreVertical } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface ActionMenuItem {
    label: string;
    icon?: LucideIcon;
    onClick: () => void;
    isDestructive?: boolean;
    isDivider?: boolean;
}

interface ActionMenuProps {
    items?: ActionMenuItem[];
    onDelete?: () => void; // Maintain backward compatibility for now
}

export const ActionMenu: React.FC<ActionMenuProps> = ({ items, onDelete }) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Legacy support if items isn't provided
    const menuItems: ActionMenuItem[] = items || (onDelete ? [
        { label: 'Delete Project', onClick: onDelete, isDestructive: true }
    ] : []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    return (
        <div ref={menuRef} style={{ position: 'relative' }}>
            <motion.button
                onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(!isOpen);
                }}
                aria-label="More actions"
                whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.15)', color: 'var(--accent)' }}
                whileTap={{ scale: 0.92 }}
                style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(15, 23, 42, 0.2)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    padding: 0,
                    transition: 'all 0.2s ease'
                }}
                className="kebab-trigger"
            >
                <MoreVertical size={18} />
            </motion.button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 5 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 5 }}
                        transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
                        style={{
                            position: 'absolute',
                            top: '100%',
                            right: 0,
                            marginTop: '8px',
                            minWidth: '180px',
                            background: 'var(--surface-light)',
                            borderRadius: '12px',
                            boxShadow: 'var(--shadow-2xl)',
                            border: '1px solid var(--border)',
                            overflow: 'hidden',
                            zIndex: 1000,
                            padding: '6px',
                            backdropFilter: 'blur(16px)'
                        }}
                    >
                        {menuItems.map((item, idx) => (
                            <React.Fragment key={idx}>
                                {item.isDivider && <div style={{ height: '1px', background: 'var(--border)', margin: '6px 4px' }} />}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsOpen(false);
                                        item.onClick();
                                    }}
                                    style={{
                                        width: '100%',
                                        padding: '10px 14px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        background: 'none',
                                        border: 'none',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        justifyContent: 'flex-start',
                                        color: item.isDestructive ? 'var(--error)' : 'var(--text-primary)',
                                        fontSize: '0.85rem',
                                        fontWeight: 500,
                                        transition: 'all 0.2s ease'
                                    }}
                                    className={`action-menu-item ${item.isDestructive ? "destructive" : "standard"}`}
                                >
                                    {item.icon && <item.icon size={14} />}
                                    {item.label}
                                </button>
                            </React.Fragment>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
