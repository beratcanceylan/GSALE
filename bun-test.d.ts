declare module 'bun:test' {
  type Matcher = {
    toBe(expected: unknown): void;
    toEqual(expected: unknown): void;
    toContain(expected: unknown): void;
    toBeGreaterThan(expected: number): void;
    toBeGreaterThanOrEqual(expected: number): void;
    toHaveLength(expected: number): void;
    toMatchObject(expected: unknown): void;
    toMatch(expected: RegExp | string): void;
    toBeUndefined(): void;
  };

  type Expectation = Matcher & {
    not: Matcher;
    resolves: Matcher;
    rejects: Matcher;
  };

  export function describe(name: string, fn: () => void): void;
  export function afterEach(fn: () => void | Promise<void>): void;
  export function test(name: string, fn: () => void | Promise<void>): void;
  export function expect<T>(value: T): Expectation;

  export const mock: {
    module(id: string, factory: () => Record<string, unknown>): void;
  };
}
