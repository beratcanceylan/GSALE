# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

The repository guidelines above (AGENTS.md) are authoritative; this file only adds what they don't cover.

## Commands

- Single test file: `bun test src/services/store/match.test.ts`; filter by name with `-t "<pattern>"`.
- Full suite as CI/coverage runs it: `bun run test:coverage` (covers `src scripts app eslint-plugin ./index.test.ts ./.github/native-sim/gate.test.ts`). `bun test src scripts` alone misses the root, ESLint-plugin and native-sim tests.
- Before finishing a change: `bun run typecheck`, `bun run lint`, and the relevant tests.

## Architecture

- **Data flow:** `app/` screens → screen stores in `src/services/screenData/` (built on `createListStore`, read via `useSyncExternalStore`; stores coalesce concurrent loads and start loading on first subscribe) → the public store API in `src/services/store/index.ts` (`searchGames`, `getGameDetail`, `getFreeGames`, `getHomeSections`) → per-store adapters in `src/services/store/platforms/`. The detail's prices come from `fetchEditionOffers`/`fetchEditionTable` in `prices.ts` (one search per store, every edition at once).
- **Search:** `store/search.ts` fans out to every adapter plus `searchCatalog` with `Promise.allSettled` (one failing store never fails the search), then merges hits in `merge.ts`. Catalog hits are appended last so live results win the merge.
- **Cancellation:** every service call takes `StoreRequestOptions` with an `AbortSignal`; call `throwIfAborted(options?.signal)` after awaits. Request counts and cancellation are asserted in `request-efficiency.test.ts` and `request-cancellation.test.ts`.
- **Constants:** timeouts/retries/user agent live in `store/constants.ts`, which has no RN/Expo imports so Bun unit tests can load it; keep it that way.
- **Custom ESLint rules** (`eslint-plugin/rules/`, applied to `app/` and `src/`): `no-react-effects` (enforces the no-`useEffect` rule), `enforce-design-tokens` (no raw colors/sizes; use `src/constants/DesignSystem.ts`), `prefer-expo-image`. `no-console` is an error outside `index.ts`. Test files are excluded from lint.
- User-facing strings come from `src/i18n/messages/<lang>.ts` through `t()`/`useT()` (30 languages). Add every new key to `en.ts` first, then to all catalogs; `src/i18n/catalogs.test.ts` enforces key and placeholder parity. The language lives in `src/i18n/languageStore.ts`, the country in `src/services/country.ts`; both are external stores, and `watchRegionChanges` reloads screen data when either changes.
- Design tokens (`src/constants/DesignSystem.ts`) keep the lint-enforced names `Palette`/`Spacing`/`Radius`/`Typography`/`Font`; use `useType()` for text styles so scripts IBM Plex Sans lacks fall back to the system font.

## Testing UI

UI/screen tests run under Bun with react-test-renderer, not a native runtime. Import `test-support/native-mocks` (and `screen-store-mocks` / `sqlite-mock` as needed) **before** dynamically importing the screen (`await import('../app/game/[id]')`), then use helpers from `test-support/render.tsx` (`render`, `byLabel`, `fire`, `updateExternalStore`). See `src/z-detail-screen.test.tsx` for the pattern.
