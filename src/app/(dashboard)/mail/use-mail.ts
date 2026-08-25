import { create } from "zustand";

interface Config {
  selected: string | null;
}

/**
 * Which enquiry the reading pane is showing.
 *
 * Starts empty. It used to be seeded with `mails[0].id` from the demo data,
 * which cannot work once the list comes from the database — the id would name
 * a message that does not exist, and the pane would open blank with no
 * explanation. Nothing selected is the honest initial state, and the pane says
 * so.
 */
const useMailStore = create<
  Config & { setState: (newState: Partial<Config>) => void }
>((set) => ({
  selected: null,
  setState: (newState) => set((state) => ({ ...state, ...newState })),
}));

export function useMail(): [Config, (newState: Partial<Config>) => void] {
  const selected = useMailStore((state) => state.selected);
  const setState = useMailStore((state) => state.setState);
  return [{ selected }, setState];
}
