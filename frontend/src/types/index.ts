export type Engine = 'xtts' | 'piper' | 'bark' | 'tortoise' | 'audiobook';
export type Status = 'queued' | 'running' | 'done' | 'failed' | 'cancelled' | 'wav';

export interface Job {
  id: string;
  engine: Engine;
  chapter_file: string;
  status: Status;
  created_at: number;
  started_at?: number;
  finished_at?: number;
  safe_mode: boolean;
  make_mp3: boolean;
  progress: number;
  eta_seconds?: number;
  log?: string;
  error?: string;
  warning_count: number;
  custom_title?: string;
  author_meta?: string;
  narrator_meta?: string;
  output_wav?: string | null;
  output_mp3?: string | null;
}

export interface Settings {
  safe_mode: boolean;
  make_mp3: boolean;
  default_engine: Engine;
  default_piper_voice?: string;
}

export interface AssemblyChapter {
  filename: string;
  title: string;
  duration: number;
}

export interface AssemblyPrep {
  chapters: AssemblyChapter[];
  total_duration: number;
}

export interface GlobalState {
  jobs: Record<string, Job>;
  settings: Settings;
  paused: boolean;
  chapters: string[];
  piper_voices: string[];
  audiobooks: string[];
  xtts_mp3: string[];
  xtts_wav_only: string[];
  piper_mp3: string[];
  piper_wav_only: string[];
  narrator_ok: boolean;
}
