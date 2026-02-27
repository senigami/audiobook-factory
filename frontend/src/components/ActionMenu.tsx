import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MoreVertical, Trash2 } from 'lucide-react';

interface ActionMenuProps {
    onDelete: () => void;
}

export const ActionMenu: React.FC<ActionMenuProps> = ({ onDelete }) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

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
                whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
                whileTap={{ scale: 0.95 }}
                style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(15, 23, 42, 0.25)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: 'white',
                    cursor: 'pointer',
                    padding: 0,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}
            >
                <MoreVertical size={16} />
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
                            minWidth: '160px',
                            background: 'var(--surface)',
                            borderRadius: '10px',
                            boxShadow: 'var(--shadow-md)',
                            border: '1px solid var(--border)',
                            overflow: 'hidden',
                            zIndex: 100,
                            padding: '4px'
                        }}
                    >
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsOpen(false);
                                onDelete();
                            }}
                            style={{
                                width: '100%',
                                padding: '8px 12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                background: 'none',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                textAlign: 'left',
                                color: 'var(--error)',
                                fontSize: '0.85rem',
                                fontWeight: 500
                            }}
                            className="menu-item-destructive"
                        >
                            <Trash2 size={14} />
                            Delete Project
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
