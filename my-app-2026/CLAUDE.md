# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Vite dev server with HMR
- `npm run build` — type-check (`tsc -b`) then bundle to `dist/`; a type error fails the build
- `npm run lint` — Oxlint (not ESLint); config in `.oxlintrc.json`
- `npm run preview` — serve the production build locally
- Type-check only: `npx tsc -b`

No test framework is set up yet.

## Stack

React 19 + TypeScript 7 + Vite 8, freshly scaffolded from `create-vite` (`react-ts` template). JSX is transformed by `@vitejs/plugin-react` (Oxc-based). React Compiler is not enabled.

## Structure

- Entry: `index.html` → `src/main.tsx` (mounts `<App />` into `#root` under `StrictMode`).
- `public/` is served as-is from the site root (`/favicon.svg`); `src/assets/` is imported and fingerprinted by Vite.
- TypeScript uses project references: `tsconfig.app.json` covers `src/` (DOM + `vite/client` types), `tsconfig.node.json` covers only `vite.config.ts` (Node types). Put new config-file TS under the node project, not the app project.

## TypeScript constraints worth knowing

- `verbatimModuleSyntax`: type-only imports must use `import type`.
- `erasableSyntaxOnly`: no `enum`, `namespace`, or constructor parameter properties — use union types / plain objects instead.
- `allowImportingTsExtensions`: local imports include the extension (e.g. `import App from './App.tsx'`), matching the existing code.
- `noUnusedLocals` / `noUnusedParameters` are on, so unused symbols break `npm run build`.

## Lint rules

`react/rules-of-hooks` is an error; `react/only-export-components` warns (keeps Fast Refresh working — component files should export only components, constants allowed). Type-aware linting is not enabled; the README describes how to turn it on via `oxlint-tsgolint`.
