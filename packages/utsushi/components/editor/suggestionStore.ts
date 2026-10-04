import type { Candidate } from "@/lib/template/candidates";

/** TipTap の Suggestion プラグインと React の候補ポップアップをつなぐ */
export type SuggestionState = {
  items: Candidate[];
  selected: number;
  rect: DOMRect | null;
  select: (c: Candidate) => void;
} | null;

export const createSuggestionStore = () => {
  let state: SuggestionState = null;
  const listeners = new Set<() => void>();
  const emit = () => {
    for (const l of listeners) l();
  };
  return {
    get: () => state,
    set: (next: SuggestionState) => {
      state = next;
      emit();
    },
    subscribe: (l: () => void) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
};

export type SuggestionStore = ReturnType<typeof createSuggestionStore>;
