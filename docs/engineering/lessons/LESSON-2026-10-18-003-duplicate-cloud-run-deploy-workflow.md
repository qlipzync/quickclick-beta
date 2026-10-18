# LESSON-2026-10-18-003 — Duplicate automatic Cloud Run deployment workflow

- **Status:** Verified from repository files and CI job logs; post-fix run pending
- **Subsystem:** CI / deployment safety
- **Observed symptom:** CI run `39157689018` failed during `npm test`, despite locked dependency installation, TypeScript check, and build succeeding.
- **Expected behavior:** One clearly controlled Cloud Run deployment path, with verification before deployment and no accidental deploy from unrelated changes.
- **Actual behavior:** `tests/production-readiness.test.mjs` asserted that `.github/workflows/google-cloudrun-docker.yml` must not exist, but that file still existed and triggered on every push to `main`. A second workflow, `.github/workflows/deploy.yml`, also contained a deployment job after manual dispatch and verification. The assertion failed at test line 58.
- **Root cause and evidence:** The workflow cleanup documented by an earlier PR was not reflected in the actual branch contents. Job logs show `npm ci --legacy-peer-deps`, `npm run lint`, and `npm run build` all passed; test `only one active Cloud Run deployment workflow remains` failed because `existsSync('.github/workflows/google-cloudrun-docker.yml')` returned true.
- **Corrective action:** Remove the duplicate push-to-main deployment workflow from the isolated feature branch. Retain the manual `deploy.yml` path, which runs verification first and gates its deploy job to `main`. This avoids deploying from this documentation/diagnostic branch.
- **Regression proof:** Re-run `npm test`; then complete CI including Firestore rules emulator, dependency audit, Docker build and container smoke test. Inspect final result and SHA before marking fully verified.
- **Affected paths:** `.github/workflows/google-cloudrun-docker.yml`, `.github/workflows/deploy.yml`, `tests/production-readiness.test.mjs`
- **Verification:** Failing run: https://github.com/qlipzync/quickclick-beta/actions/runs/39157689018 — install, typecheck and build passed; 10/11 tests passed; duplicate-workflow assertion failed. Fix commit: `d6c48a54227de8ffe1ac6e2645ee2879f41f5fdb`; post-fix workflow result pending.
- **Sandbox boundary:** Change is on `feat/harness2-lessons-library`; no production deployment was triggered.
- **Related issue/PR:** Issue #4; PR #5.
- **Reusable rule:** When CI fails, inspect the first failing test and the exact commit contents. Do not attribute the failure to a historic error if the current run proves the install step passes. Treat deployment workflow inventory as a safety invariant, not merely a test-maintenance detail.
