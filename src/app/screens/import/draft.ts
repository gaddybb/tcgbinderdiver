// An import that was started and not finished, kept on the device so My lists can offer Resume.
// It holds what the player filled in on step 1 (the lookup itself is run again, which is quick with the local card data).
import type { IncludeSections } from '../../../core/parse/parseDecklist';
import type { AppStorage } from '../../../storage';

export type ImportTarget = 'deck' | 'wishlist';
export type LimitChoice = 'split' | 'first';

export interface ImportDraft {
  target: ImportTarget;
  name: string;
  text: string;
  include: IncludeSections;
  limitChoice: LimitChoice;
  done: number;            // cards looked up when it stopped
  total: number;
  savedAt: string;         // ISO
}

const KEY = 'import-draft';

export const loadDraft = (storage: AppStorage): Promise<ImportDraft | undefined> => storage.get<ImportDraft>('settings', KEY);
export const saveDraft = (storage: AppStorage, draft: ImportDraft): Promise<void> => storage.put('settings', KEY, draft);
export const clearDraft = (storage: AppStorage): Promise<void> => storage.delete('settings', KEY);
