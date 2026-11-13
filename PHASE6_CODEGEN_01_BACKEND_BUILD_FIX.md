# Code Generation Prompt — Phase 6 Step 1 (Backend Build Fix)

**Tool:** external code generator (ChatGPT regular chat)  
**Project:** Project Manager — `<workspace>`  
**Stack:** React 19 + TypeScript + Vite + Tailwind frontend; Express + TypeScript backend; SQLite via `node:sqlite`; JWT auth.  
**Phase:** 6 — Shared Foundation & Project Canvas Implementation  
**Card:** PM-P6-02 (first implementation step)  
**Owner authorization:** Phase 6 implementation authorized.

## Objective

Fix the backend TypeScript build failure without changing runtime behavior, route registration, or any other source file. Return a complete replacement for **one file only**: `backend/tsconfig.json`.

## Current file (complete source)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": false,
    "sourceMap": true,
    "types": [
      "node"
    ],
    "noUncheckedIndexedAccess": true,
    "allowImportingTsExtensions": true,
    "noImplicitOverride": true
  },
  "include": [
    "src/**/*.ts"
  ],
  "exclude": [
    "node_modules",
    "dist"
  ]
}
```

## Current package script (do not change)

`backend/package.json` script:

```json
"build": "tsc"
```

## Failure

```text
tsconfig.json(19,35): error TS5096: Option 'allowImportingTsExtensions' can only be used when either 'noEmit' or 'emitDeclarationOnly' is set.
```

`npm run typecheck` (`tsc --noEmit`) passes. `npm run build` (`tsc`) fails.

## Acceptance criteria

1. `npm run build --prefix backend` exits 0 with no `error TS` lines.
2. `npm run typecheck --prefix backend` still exits 0.
3. `backend/src` is unchanged.
4. No route, service, schema, or runtime behavior changes.
5. `dist/` output remains emitted under `backend/dist`.
6. The fix must be a complete replacement file, valid JSON, with a clear explanation of the change.

## Constraints

- Do not invent APIs, change source files, or add dependencies.
- Do not remove `allowImportingTsExtensions` unless you also provide a source-level migration that is explicitly out of scope here.
- Prefer the minimal correct compiler option change.
- Report the exact command you would run to verify.

Return the complete replacement `backend/tsconfig.json` in one fenced JSON block, then a short explanation.
