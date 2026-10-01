import { create } from 'zustand';

import { DEFAULT_SUBJECT, type SubjectId } from '@/constants/subjects';
import type { ToolSelection } from '@/constants/tools';
import type { ImageAttachment } from '@/lib/types';

export type AppMode = 'camera' | 'chat' | 'record';

interface UIState {
  mode: AppMode;
  /** Subject used for the next new chat (and mirrored from the active chat). */
  subject: SubjectId;
  tool: ToolSelection | null;
  draft: string;
  pendingImages: ImageAttachment[];
  setMode: (mode: AppMode) => void;
  setSubject: (subject: SubjectId) => void;
  setTool: (tool: ToolSelection | null) => void;
  setDraft: (draft: string) => void;
  addPendingImage: (image: ImageAttachment) => void;
  removePendingImage: (id: string) => void;
  clearComposer: () => void;
}

export const useUI = create<UIState>()((set, get) => ({
  mode: 'chat',
  subject: DEFAULT_SUBJECT,
  tool: null,
  draft: '',
  pendingImages: [],
  setMode: (mode) => set({ mode }),
  setSubject: (subject) => set({ subject }),
  setTool: (tool) => set({ tool }),
  setDraft: (draft) => set({ draft }),
  addPendingImage: (image) => set({ pendingImages: [...get().pendingImages, image].slice(-4) }),
  removePendingImage: (id) => set({ pendingImages: get().pendingImages.filter((i) => i.id !== id) }),
  clearComposer: () => set({ draft: '', pendingImages: [], tool: null }),
}));
