import React from 'react';
import { AnimatePresence } from 'framer-motion';
import { ChapterCard } from './ChapterCard';
import type { Job } from '../types';

interface ChapterGridProps {
  chapters: string[];
  jobs: Record<string, Job>;
  selectedFilename: string | null;
  onSelect: (filename: string) => void;
  viewMode: 'grid' | 'list';
  statusSets: {
    xttsMp3: string[];
    xttsWav: string[];
  };
  onRefresh?: () => void;
  onOpenPreview?: (filename: string) => void;
  makeMp3?: boolean;
  requestConfirm?: (config: {
    title: string;
    message: string;
    onConfirm: () => void;
    isDestructive?: boolean;
    confirmText?: string;
  }) => void;
}

export const ChapterGrid: React.FC<ChapterGridProps> = ({
  chapters,
  jobs,
  selectedFilename,
  onSelect,
  viewMode,
  statusSets,
  onRefresh,
  onOpenPreview,
  makeMp3,
  requestConfirm
}) => {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: viewMode === 'grid' ? 'repeat(auto-fill, minmax(280px, 1fr))' : '1fr',
      gap: '1rem',
    }}>
      <AnimatePresence mode="popLayout">
        {chapters.map((filename) => (
          <ChapterCard
            key={filename}
            filename={filename}
            job={jobs[filename]}
            isActive={selectedFilename === filename}
            onClick={() => onSelect(filename)}
            onRefresh={onRefresh}
            onOpenPreview={onOpenPreview}
            statusInfo={{
              isXttsMp3: statusSets.xttsMp3.includes(filename),
              isXttsWav: statusSets.xttsWav.includes(filename),
            }}
            makeMp3={makeMp3}
            requestConfirm={requestConfirm}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};
