// Minimal typings for the bun:sqlite APIs used by scripts/catalog and catalog tests.
declare module 'bun:sqlite' {
  type Binding = string | number | bigint | boolean | null | Uint8Array;

  export class Statement<Row = unknown> {
    all(...params: Binding[]): Row[];
    get(...params: Binding[]): Row | null;
    run(...params: Binding[]): void;
  }

  export class Database {
    constructor(filename?: string, options?: { create?: boolean; readonly?: boolean });
    exec(sql: string): void;
    query<Row = unknown>(sql: string): Statement<Row>;
    prepare<Row = unknown>(sql: string): Statement<Row>;
    transaction<Args extends unknown[]>(fn: (...args: Args) => void): (...args: Args) => void;
    close(): void;
  }
}
