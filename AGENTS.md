# Repository Guidelines

## Project Structure & Module Organization

GSale is a native-only Expo Router application. Routes are in `app/` (Expo Router's default root), reusable UI in `src/components/`, and tokens in `src/constants/DesignSystem.ts`. Store integrations are under `src/services/store/`; `platforms/` contains Steam, Epic, GOG, Xbox, PlayStation, and Nintendo adapters. Screen stores are in `src/services/screenData/`, mapping in `src/services/gameData.ts`, and assets in `assets/`. Tests are colocated as `*.test.ts` files.

## Build, Test, and Development Commands

Use Bun exclusively (`bun install`, `bun run ...`, `bunx --bun ...`). Do not use npm/npx/yarn/pnpm and do not create or commit `package-lock.json`; `bun.lock` is the only tracked lockfile.

- `bun install` - install dependencies.
- `bun run start:clear` - start Metro with a clean cache; `bun run start` starts normally.
- `bun run android` / `bun run ios` - build and launch the native app.
- `bun run prebuild` - regenerate native projects after Expo config changes.
- `bun run test:store` - run store tests; `bun test src scripts` runs the full test tree.
- `bun run scripts/catalog/build.ts --source <game-store-catalog checkout> --out <dir>` - build the catalog locally.
- `bun run typecheck` - run TypeScript checks, including the ESLint plugin project.
- `bun run lint` - run ESLint; `bun run doctor` runs React Doctor.

## Architecture & Constraints

`index.ts` performs only locale, store country and splash bootstrap. Screens use external stores with `useSyncExternalStore`; do not add React effects in `app/` or `src/`. Preserve the 30-game limit, timeout/retry values, and 60-second price cache. Do not introduce a backend, persistent price store, or React Query/SWR. Run `bun run prebuild` after native config or font changes.

The store region comes from the country setting in `src/services/country.ts`; adapters read it through `getStoreCountry()` / `getStoreCountryConfig()` and never hard-code a country, market or `xx-yy` path. Regional prices are converted to TL with `currency.ts` (per-currency FX rates); the in-app price cache key includes the country. Nintendo always uses the US eShop, and PlayStation is skipped where `playStationCurrency` is `null`.

The home tab shows one discounted-games strip per store (`src/services/store/home.ts`, each adapter's `fetch*Deals`). The game catalog is a SQLite file built by `scripts/catalog/build.ts` in `.github/workflows/catalog.yml` from Ephellon/game-store-catalog and published as `catalog-latest` release assets; `src/services/catalog/loader.ts` downloads it (base URL in `EXPO_PUBLIC_CATALOG_BASE_URL`) and `state.ts` exposes it. Catalog hits are added to search (Steam and Xbox ids only), and price lookups skip a catalog-covered store only when none of its titles contains the game's name. Without a catalog the app falls back to live search. Stores are shown with monochrome Simple Icons marks (`StoreLogo`, CC0); Xbox and Nintendo have no licensed mark there and show their name.

Editions: `src/services/store/editions.ts` is the only edition parser (`editionKey`, `baseTitle`, `isDlcTitle`), in every store language. Each adapter's `fetch<Store>EditionOffers` does one search with the base title; `prices.ts` builds the edition × store table (`fetchEditionTable`). A store's price is shown for an edition only when that store's product has the same `editionKey` — never substitute another edition. The detail screen opens on the route product's edition and switching editions makes no request.

Language and country are separate settings. UI text comes from `src/i18n/messages/<lang>.ts` via `t()`/`useT()`; services return codes, never user-facing text. Adapters take their language from `storeLanguage()`/`regionalLocale()` (`src/services/store/languages.ts`), which fall back to the country's store language when a store does not offer the app language. Prices reach the UI as numbers (`src/services/deal.ts`) and are formatted with `formatMoney`/`formatPercent`. Arabic switches the layout to RTL after a restart (`src/i18n/rtl.ts`); use `start`/`end` in styles.

## Coding Style & Naming Conventions

Use TypeScript ESM, two-space indentation, `@/` aliases, and explicit service types. Use PascalCase for components/types, camelCase for functions/stores, and `useX` for hooks. Use design tokens, `lucide-react-native`, and `expo-image`; avoid web-only imports. Hermes lacks `toSorted`, so copy before `sort`.

## Testing Guidelines

Use Bun's `describe`/`test` APIs and `*.test.ts` filenames. Mock network responses at adapter boundaries and cover matching, prices, retries, cancellation, and request counts. No coverage threshold is configured; changes should include focused tests and pass both commands.

## Commit & Pull Request Guidelines

The existing history uses short, lowercase subjects (for example, `4 eylul`). Keep new subjects concise and imperative, optionally scoped as `fix(store): ...`. PRs should explain behavior/performance impact, list validation commands, link an issue, and include screenshots or a recording for UI changes. Call out required `app.json`/`prebuild` steps.

## Security & Configuration

Keep requests on fixed HTTPS origins, encode route/query inputs, and open external links only after HTTPS validation. Do not add a backend, persistent price cache, or React Query/SWR without an explicit design decision. Never commit credentials, local databases, generated `android/`/`dist/`, or `.env` files.
