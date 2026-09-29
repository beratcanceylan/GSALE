// Typings for the subset of bun:test the project uses (the app has no @types/bun).
declare module 'bun:test' {
  type Matchers<R> = {
    toBe(expected: unknown): R;
    toEqual(expected: unknown): R;
    toContain(expected: unknown): R;
    toContainEqual(expected: unknown): R;
    toBeDefined(): R;
    toBeGreaterThan(expected: number): R;
    toBeGreaterThanOrEqual(expected: number): R;
    toBeLessThan(expected: number): R;
    toHaveLength(expected: number): R;
    toMatchObject(expected: unknown): R;
    toMatch(expected: RegExp | string): R;
    toBeUndefined(): R;
    toBeNull(): R;
    toBeTrue(): R;
    toBeFalse(): R;
    toThrow(expected?: RegExp | string): R;
  };

  type Expectation = Matchers<void> & {
    not: Matchers<void>;
    resolves: Matchers<Promise<void>>;
    rejects: Matchers<Promise<void>>;
  };

  type TestFn = () => void | Promise<void>;

  type Each = <T extends readonly unknown[]>(
    cases: readonly T[],
  ) => (name: string, fn: (...args: [...T]) => void | Promise<void>) => void;

  export const describe: ((name: string, fn: () => void) => void) & { each: Each };
  export const test: ((name: string, fn: TestFn, timeoutMs?: number) => void) & { each: Each };
  export function beforeEach(fn: TestFn): void;
  export function afterEach(fn: TestFn): void;
  export function afterAll(fn: TestFn): void;
  export function expect<T>(value: T): Expectation;

  export const mock: {
    module(id: string, factory: () => Record<string, unknown>): void;
  };
}
