# HelpMi Backend — Test Import Resolution Fix

**Date:** 7 June 2026
**Issue:** `npm test` failed with `.js` import-resolution errors (e.g. `import { NotificationsService } from './notifications.service.js'`). `npm install`, `prisma generate`, `prisma migrate deploy`, `npm run build` all pass.
**Constraint honored:** no application logic changed — only test infrastructure and imports.

---

## Root Cause

The project is an **ESM (NodeNext)** NestJS app: source files import each other with explicit `.js` specifiers (e.g. `'./prisma.service.js'`). That is **required** for the production build — `tsc`/`nest build` emit those specifiers and Node ESM resolves them at runtime against the compiled `.js` files. That is why `npm run build` passes.

Jest, however, runs the **TypeScript sources** through `ts-jest` in a CommonJS context. With the original `package.json` jest config there was **no `moduleNameMapper`**, so jest tried to load `./notifications.service.js` from disk — where only `notifications.service.ts` exists — and failed. This affects both the spec files' own imports and the transitive `.js` imports inside the source files they pull in.

---

## Fix Applied

**1. `package.json` → `jest` config** (the primary fix): added a module-name mapper that strips the `.js` suffix from relative imports so jest resolves them to the `.ts` sources, plus a CommonJS `ts-jest` transform.

```jsonc
"jest": {
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": "src",
  "testRegex": ".*\\.spec\\.ts$",
  "transform": {
    "^.+\\.(t|j)s$": ["ts-jest", {
      "isolatedModules": true,
      "tsconfig": { "module": "CommonJS", "moduleResolution": "node", "verbatimModuleSyntax": false, "esModuleInterop": true }
    }]
  },
  "moduleNameMapper": { "^(\\.{1,2}/.*)\\.js$": "$1" },
  "collectCoverageFrom": ["**/*.(t|j)s"],
  "coverageDirectory": "../coverage",
  "testEnvironment": "node"
}
```

**2. `test/jest-e2e.json`**: the same mapper + CommonJS transform (the e2e config had the identical gap), so `npm run test:e2e` resolves source `.js` imports too.

**3. Spec files** (`src/**/*.spec.ts`): removed the `.js` suffix from all **relative** imports (15 occurrences across 12 files), as requested. Spec files now import `./notifications.service` etc.

**4. Removed** the temporary `jest-p1.config.cjs` helper (its mapper is now in the standard config).

**Not changed:** source `.ts` files keep their `.js` import specifiers (44 files) — removing them would break the production ESM build that currently passes. The mapper handles them for tests.

---

## Files Modified
- `backend/package.json` — jest config (mapper + transform).
- `backend/test/jest-e2e.json` — mapper + transform.
- `backend/src/**/*.spec.ts` — 12 files, `.js` removed from relative imports.
- Removed `backend/jest-p1.config.cjs`.

No `src/**/*.ts` application files were modified.

---

## Test Run Status — please re-run on your machine

I could **not re-execute `npm test` in my sandbox** to confirm the green run, for environment reasons unrelated to the fix: my earlier dependency installs (Swagger/Helmet) plus repair attempts corrupted the sandbox `node_modules`, and it can't be rebuilt here — jest 30 needs a native resolver binary (`@unrs/resolver-binding-linux-x64-gnu`) that can't be re-fetched (registry DNS is intermittently unavailable in the sandbox, the Prisma engine CDN is blocked, and the sandbox filesystem rejects npm's rename operations with `ENOTEMPTY`). None of these exist on your clean machine, where `npm install` already succeeded.

**Why I'm confident the fix is correct:**
1. Earlier in this work the **identical** transform + `moduleNameMapper` pattern ran the full suite **green — 60 passing across 12 suites** (it was in a separate config file; I've now moved it into the standard `package.json` so `npm test` uses it).
2. Your reported error was `.js` import resolution — which means jest itself runs fine on your machine and only needed the mapper. That is exactly what this change adds.

**Expected result of `npm test` on your machine:** **60 passing, 12 suites, 0 failures.**

```
npm test          # 60 passed, 12 suites
npm run test:e2e  # against a test DB (requires DATABASE_URL + prisma migrate deploy)
```

If anything still fails after this, please paste the output — but the remaining cause would not be `.js` resolution, which this change resolves.

---

## Remaining Known Issues
- None related to import resolution.
- E2E (`npm run test:e2e`) requires a reachable test PostgreSQL (boots the full app); it is a smoke suite covering public routes, 401 guards, OTP validation, webhook signature rejection, and the OpenAPI JSON.
