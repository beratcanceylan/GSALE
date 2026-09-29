import type { ReactElement } from 'react';
import TestRenderer, { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

export type Rendered = Readonly<{
  renderer: ReactTestRenderer;
  root: ReactTestInstance;
  /** All text content, joined, for simple "is it on screen" checks. */
  text: () => string;
  update: (element: ReactElement) => Promise<void>;
  unmount: () => Promise<void>;
}>;

/** Resolves pending promises (store loads, fetch mocks) inside act(). */
export async function flush(times = 5): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

/** Notify React after an external store changes during a screen test. */
export async function updateExternalStore(update: () => void): Promise<void> {
  await act(async () => {
    update();
    await Promise.resolve();
  });
}

type JsonNode = ReturnType<ReactTestRenderer['toJSON']> | string;

function collectText(node: JsonNode): string {
  if (node === null) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(collectText).join(' ');
  return (node.children ?? []).map((child) => collectText(child)).join(' ');
}

export async function render(element: ReactElement): Promise<Rendered> {
  let renderer: ReactTestRenderer | undefined;
  await act(async () => {
    renderer = TestRenderer.create(element);
  });
  if (!renderer) throw new Error('render failed');
  const created = renderer;
  return {
    renderer: created,
    root: created.root,
    text: () => collectText(created.toJSON()),
    update: async (next) => {
      await act(async () => {
        created.update(next);
      });
    },
    unmount: async () => {
      await act(async () => {
        created.unmount();
      });
    },
  };
}

/** Finds the element whose accessibilityLabel equals (or contains) `label`. */
export function byLabel(root: ReactTestInstance, label: string): ReactTestInstance {
  return root.find(
    (node) => typeof node.type === 'string' && String(node.props['accessibilityLabel'] ?? '').includes(label),
  );
}

export function allOfType(root: ReactTestInstance, type: string): ReactTestInstance[] {
  return root.findAll((node) => node.type === type);
}

/** Calls a host element's event handler inside act(). */
export async function fire(node: ReactTestInstance, event: string, ...args: unknown[]): Promise<void> {
  const handler = node.props[event] as ((...values: unknown[]) => unknown) | undefined;
  if (!handler) throw new Error(`no ${event} handler on ${String(node.type)}`);
  await act(async () => {
    await handler(...args);
  });
}
