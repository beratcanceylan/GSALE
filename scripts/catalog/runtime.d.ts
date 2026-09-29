// Minimal typings for the Node/Bun APIs scripts/catalog uses; the app has no @types/node.
declare module 'node:fs' {
  export function mkdirSync(path: string, options?: { recursive?: boolean }): void;
  export function readdirSync(path: string): string[];
  export function readFileSync(path: string, encoding: 'utf8'): string;
  export function rmSync(path: string, options?: { force?: boolean; recursive?: boolean }): void;
  export function statSync(path: string): { size: number };
  export function writeFileSync(path: string, data: string): void;
}

declare module 'node:path' {
  export function join(...paths: string[]): string;
}

declare namespace NodeJS {
  interface Process {
    argv: string[];
  }
}

interface ImportMeta {
  readonly main: boolean;
}
