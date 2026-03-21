---
id: clmem-x2a
title: Fix TypeScript type system for Bun — tsc --noEmit clean
status: active
type: task
priority: 1
parent: clmem-l6j
---


## Context
First task in Phase 1 (clmem-l6j) of the refactor epic (clmem-cj3). Must land before structural decomposition tasks — those will create/move files and having a clean type baseline prevents cascading type errors during refactoring.

The project compiles and runs with Bun but `npx tsc --noEmit` (project-local TS 5.9.3) reports **300 errors across 63 files**. Error taxonomy (SRE-verified 2026-03-21):

| Category | Count | Example | Fix approach |
|----------|-------|---------|--------------|
| Component type too narrow | ~142 (TS2345) | `"SEARCH"`, `"CONSOLE"`, `"CURSOR"`, `"SHUTDOWN"`, `"DEDUP"`, `"IMPORT"` not assignable to `Component` | Widen the Component type union |
| Missing DOM types | ~42 (TS2584+TS2304+TS2812) | `document`, `window`, `localStorage` in `src/ui/viewer/` | Add `"dom"` to tsconfig `lib` |
| Missing bun:sqlite module | ~23 (TS2307) | `Cannot find module 'bun:sqlite'` across sqlite/ | Install `bun-types`, update tsconfig `types` |
| Type mismatches | ~56 (TS2322+TS2339+TS18046) | `ObservationRecord` vs `ObservationSearchResult`, `ProcessEnv` | Structural type fixes |
| Nullable access | ~7 (TS18047) | Possibly-null access | Add null guards |
| Other | ~30 | Various | Case-by-case |

**CRITICAL: Global `tsc` is v4.9.5 (pnpm), project-local is 5.9.3.** Always use `npx tsc --noEmit`. The global tsc shows different errors (258 from zod v4 `.d.cts` files only, 0 from source).

## Requirements
R5. Fix TypeScript type system for Bun: configure tsconfig with bun-types, fix all type mismatches, achieve `tsc --noEmit` clean.

## Implementation
1. Install `bun-types` — `bun add -d bun-types`. Current devDeps: `@types/node@^20.0.0`, `typescript@^5.3.0`, no bun-types.
2. Update `tsconfig.json`:
   - Change `"types": ["node"]` → `"types": ["bun-types"]` (bun-types includes Node types; removes need for `@types/node`)
   - Add `"dom"` to `"lib"` array: `"lib": ["ES2022", "dom", "dom.iterable"]` — needed for React UI in `src/ui/viewer/`
   - Consider changing `"moduleResolution": "node"` → `"bundler"` for modern ESM compat (verify this doesn't break existing imports)
3. Fix `Component` type union — find the type definition via LSP, add missing literals: `"SEARCH"`, `"CONSOLE"`, `"CURSOR"`, `"SHUTDOWN"`, `"DEDUP"`, `"IMPORT"` (142 errors)
4. Fix `ObservationRecord` vs `ObservationSearchResult` mismatch — investigate whether SearchManager callers need the full search result type or if record type can be extended. NO runtime behavior changes.
5. Fix `WorkerService` type errors — `ProcessEnv` → `Record<string, string>` mismatch (line 439), `WorkerRef` private field visibility (lines 569, 752, 764)
6. Fix remaining type errors — nullable access (TS18047), property-does-not-exist (TS2339), unknown-typed expressions (TS18046). Case-by-case structural fixes.
7. Run `npx tsc --noEmit` — must exit 0. (MUST use npx, not bare `tsc`)
8. Run `npm run build-and-sync` — must succeed
9. Run `bun test` — all existing tests must pass

## Success Criteria
- [ ] `npx tsc --noEmit` exits 0 (project-local TS 5.9.3, NOT global tsc 4.9.5)
- [ ] `npm run build-and-sync` succeeds
- [ ] All existing tests pass (`bun test`)
- [ ] No `as any` casts added to suppress errors
- [ ] `bun-types` configured in tsconfig `types` array
- [ ] Component type union includes all string literals used in codebase (no TS2345 on component strings)

## Anti-Patterns
- NO `as any` casts — structural fixes only
- NO `@ts-ignore` or `@ts-expect-error` to suppress errors
- NO changing runtime behavior — type fixes only affect the type checker, not runtime
- NO modifying tsconfig in ways that weaken type checking (e.g., adding `"skipLibCheck": true` doesn't count as fixing — it's already set)
- NO using global `tsc` (4.9.5) instead of `npx tsc` (5.9.3) — global version shows false clean on source files
- NO widening types to `string` when specific union members are needed — add the specific literals to the union
- NO removing `strict: true` or any strict-family flags from tsconfig
- NO adding `exclude` patterns to hide error-producing files — fix the types

## Key Considerations
- **Global vs local tsc:** Global `tsc` is 4.9.5 (from pnpm at `/Users/seth/Library/pnpm/tsc`), which can't parse zod v4 `.d.cts` files and shows 258 node_modules errors + 0 source errors. Project-local (npx tsc) is 5.9.3 and shows the real 300 source errors. Always use `npx tsc --noEmit`.
- **DOM types for UI:** The `src/ui/viewer/` directory contains React components using `document`, `window`, `localStorage`, etc. Adding `"dom"` to tsconfig lib is necessary and correct — these ARE browser-targeted files built by esbuild into `plugin/ui/viewer.html`. This is not weakening type checking; it's providing correct types for the target environment.
- **bun-types vs @types/node:** `bun-types` includes Node.js type declarations. After adding bun-types, evaluate whether `@types/node` should be removed from devDeps to avoid duplicate/conflicting type definitions. If both are present, `bun-types` should take precedence via tsconfig `types`.
- **Component type investigation:** The Component type union is missing at least 6 string literals used across the codebase. Find the definition via LSP before adding members — there may be a deliberate design reason for the limited set (e.g., log-level filtering). Adding members to a union type is safe for existing code (additive).
- **ObservationRecord mismatch:** `ObservationSearchResult` has extra fields (`subtitle`, `facts`, `narrative`, `concepts`, +2 more) not on `ObservationRecord`. SearchManager assigns `ObservationRecord[]` where `ObservationSearchResult[]` is expected. Options: (a) make SearchManager map records to search results, (b) widen the return type, (c) extend ObservationRecord. Must investigate callers to decide.
- **WorkerRef private field visibility:** `WorkerService` passes `this` as `WorkerRef`, but `sseBroadcaster` is `private` in WorkerService vs non-private in WorkerRef interface. Fix: align visibility modifiers.
- **moduleResolution change risk:** Changing from `"node"` to `"bundler"` could break existing bare specifier imports. Test incrementally — if it causes new errors, keep `"node"` and address module resolution separately.

### Adversarial Failure Catalog (2026-03-21)

**Input Hostility: Component type union**
- Assumption: Adding string literals to the Component union is additive and won't break callers
- Betrayal: If any code uses exhaustive switch/match on Component (e.g., `default: assertNever(component)`), adding new union members causes compile errors at those exhaustive checks
- Consequence: "Type fix only" task silently introduces compile errors elsewhere, or agent removes exhaustive checks to make it compile (runtime behavior change)
- Mitigation: Before widening Component, search for exhaustive pattern matching on the type via LSP (`findReferences` on the type). If exhaustive switches exist, each new member needs a handler — which is a design decision, not a type fix. Surface to user if found.

**Temporal Betrayal: bun-types replacing @types/node**
- Assumption: Changing `"types"` from `["node"]` to `["bun-types"]` is a drop-in replacement
- Betrayal: `bun-types` may define globals differently from `@types/node` (e.g., `process.env` type, `Buffer` API surface, `setTimeout` return type). Code compiled clean against `@types/node` may get new errors against `bun-types`.
- Consequence: Fixing 23 `bun:sqlite` errors but introducing 30+ new errors from bun-types vs node-types divergence
- Mitigation: Add `bun-types` FIRST, run `npx tsc --noEmit`, capture new error count BEFORE removing `@types/node` from types array. If new errors appear, keep both in types and assess which conflicts need resolution.

**Dependency Treachery: moduleResolution change**
- Assumption: Changing from `"node"` to `"bundler"` improves module resolution
- Betrayal: Existing imports that rely on `"node"` resolution quirks may break with `"bundler"`
- Consequence: New TS2307 errors from imports that worked under `"node"` resolution
- Mitigation: **Consider skipping this change entirely** — `"node"` resolution works for the current codebase, and changing it is scope creep beyond R5. Only change if required to resolve a blocking issue.

**State Corruption: ObservationRecord type alignment**
- Assumption: Extending `ObservationRecord` with fields from `ObservationSearchResult` is purely a type change
- Betrayal: If ObservationRecord is used as the shape for SQLite query results, adding fields to the type doesn't make SQLite return those fields. Code that accesses the new fields on a record from SQLite gets `undefined` at runtime despite TypeScript saying the field exists.
- Consequence: Silent runtime bugs — TypeScript says field is `string`, runtime value is `undefined`
- Mitigation: The correct fix may be to narrow the return type in SearchManager (use `ObservationRecord[]` where that's what's actually returned), NOT to widen ObservationRecord. Investigate the actual data flow first.

**State Corruption: Scattered type fixes across 63 files**
- Assumption: Adding null guards, narrowing types, fixing property access is safe mechanical work
- Betrayal: An agent fixing 300 errors across 63 files in a single pass will lose track of which changes are purely type-level and which touch runtime behavior. A null guard like `if (x != null)` changes control flow.
- Consequence: "Type-only" changes silently alter runtime behavior in a subset of fixes
- Mitigation: For each fix category, establish the pattern once (e.g., "null guards use early return, not conditional wrapping"), then apply mechanically. Tests are the proof of no behavior change.
