/** Whether the saved language and country are loaded; screens wait for it so they never load twice. */
let ready = false;
const listeners = new Set<() => void>();

export const startupStore = {
  getSnapshot: (): boolean => ready,
  subscribe: (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export function markStartupReady(): void {
  if (ready) return;
  ready = true;
  for (const listener of listeners) listener();
}
