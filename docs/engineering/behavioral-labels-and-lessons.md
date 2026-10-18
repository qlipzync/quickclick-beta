# Behavioral-Contrast Labels and Lessons Library

## Purpose

Labels describe observable behavior, not intentions. Contrast pairs make the desired behavior explicit and improve issue triage, reviews, and regression-test design.

## Label taxonomy

Create these repository labels with the descriptions below. GitHub label creation is not exposed by the current connector, so this table is the authoritative setup specification until an administrator creates them.

| Label | Description | When to apply |
|---|---|---|
| `behavior:regression` | Behavior changed from the expected contract | Established behavior unexpectedly breaks |
| `behavior:fail-closed` | Missing or invalid inputs are rejected safely | Auth, signature, configuration, or policy checks reject invalid states |
| `behavior:fail-open` | Missing or invalid inputs bypass a required guard | Requests continue despite missing security configuration or failed validation |
| `behavior:idempotent` | Repeated execution does not duplicate side effects | Retry/replay is durably deduplicated and covered by a test |
| `behavior:non-idempotent` | Repeated execution may duplicate side effects | A replay could issue credits or repeat a business mutation |
| `behavior:deterministic` | Equivalent inputs produce reproducible results | Build, test, or lockfile output is reproducible |
| `behavior:non-deterministic` | Uncontrolled state changes the outcome | Floating dependencies, races, or time-dependent tests affect results |
| `behavior:degraded` | Fallback preserves safety and observability | Dependency failure is reported and the service fails safely |
| `behavior:unsafe-fallback` | Fallback hides failure or weakens a guard | Mocked success is reported as real delivery or validation is skipped |
| `learning:lesson-captured` | An evidence-backed reusable lesson was recorded | Root cause and evidence are documented |
| `learning:lesson-applied` | A prior lesson materially informed this task | Retrieved guidance changed the implementation or avoided a repeat failure |
| `verification:rerun-required` | Bounded additional verification is required | Fix is not accepted until a fresh run completes |
| `verification:sandbox-only` | Validation must remain isolated from production | Tests touch billing, publishing, credentials, or cloud resources |

Suggested color semantics: unsafe behavior red/orange, desired behavior green/blue, learning purple, verification yellow. Labels are classifiers, not a substitute for evidence.

## Labeling rules

- Use both sides of a behavioral contrast when useful, for example `behavior:fail-open` and `behavior:fail-closed`.
- Only use `behavior:idempotent` when the durable mechanism and replay test exist.
- One successful run does not prove determinism.
- Apply `learning:lesson-captured` only to evidence-backed lessons. Mark assumptions as hypotheses.
- Use `verification:rerun-required` until the final relevant run passes.
- Use `verification:sandbox-only` for isolated test resources and never interpret it as permission to touch production.

## Lessons workflow

### Before a task
1. Search this library for matching symptoms, subsystems, and failure modes.
2. Link applicable lesson IDs from the task issue or PR.
3. Define baseline evidence, a minimal candidate change, regression proof, a run budget, and sandbox boundaries.

### During a task
1. Keep each candidate isolated on a feature/fix branch.
2. Compare baseline and candidate with the same runtime, lockfile policy, commands, and environment.
3. Separate proposals from observations. Record negative results and avoid repeating disproven variants.
4. Rerun only failed or stale checks after a targeted fix; run the full suite when integration risk warrants it.
5. Never automatically repeat operations with external side effects unless durable idempotency is proven.

### After a task
1. Capture the symptom, expected and actual behavior, root cause, correction, regression proof, affected paths, commit SHA, and final CI run.
2. Record status as **Verified** or **Hypothesis**; do not promote an inference to fact.
3. Link the lesson to the issue/PR and apply `learning:lesson-captured`.
4. If a prior lesson was used, apply `learning:lesson-applied` and state how it changed the work.

## Bounded verification and sandbox policy

- Use CI, local tests, Firebase emulators, Stripe test mode, and non-production cloud resources.
- Do not deploy to production to collect evidence.
- Budget: one baseline run; one targeted rerun after the fix; at most one clean full workflow rerun if environment state is stale or the targeted result is inconclusive. If still failing, stop and diagnose instead of looping.
- Check exact commit SHA, failed step, and final conclusion. Queued or in-progress jobs are not success.
- Synthetic or mocked responses prove only that mock path, not actual provider delivery.
- Keep secrets out of logs and lesson records.

## Lesson entry template

### LESSON-YYYY-MM-DD-NNN — Short title

- **Status:** Verified | Hypothesis
- **Subsystem:** CI / dependencies / API / queue / security / publishing / infrastructure
- **Observed symptom:**
- **Expected behavior:**
- **Actual behavior:**
- **Root cause and evidence:**
- **Corrective action:**
- **Regression proof:**
- **Affected paths:**
- **Verification:** commit SHA, workflow/run URL, final status, reruns
- **Sandbox boundary:** resources used; confirmation of no production mutation
- **Related issue/PR:**
- **Reusable rule:**

## Initial lessons

### LESSON-2026-10-18-001 — npm ci requires manifest/lockfile consistency

- **Status:** Verified symptom; exact mismatched package awaits full log inspection
- **Subsystem:** CI / dependencies
- **Observed symptom:** Reported CI install error says `npm ci` cannot install because `package.json` and `package-lock.json` are not in sync.
- **Expected behavior:** A clean checkout installs exactly from the committed lockfile.
- **Actual behavior:** Dependency installation exits non-zero before build or tests run.
- **Root cause and evidence:** The manifest and lockfile metadata disagree. The exact package/version must be identified from the complete npm error; do not guess.
- **Corrective action:** Regenerate the lockfile using the project's supported npm version and peer-dependency policy, review the diff, then commit manifest and lockfile together if both require changes. Do not hand-edit lock metadata.
- **Regression proof:** Run `npm ci --legacy-peer-deps` from a clean checkout, then lint/typecheck, build, tests, rules-emulator tests, audit, Docker build, and smoke test.
- **Affected paths:** `package.json`, `package-lock.json`, `.github/workflows/ci.yml`
- **Verification:** User-reported CI error; post-fix verification not yet performed.
- **Sandbox boundary:** Branch and CI only; no deployment.
- **Related issue/PR:** Issue #4; review open dependency/production readiness PRs before touching the same files.
- **Reusable rule:** An install-stage failure blocks downstream steps. Do not say application tests failed or passed if they never ran.

### LESSON-2026-10-18-002 — Security-sensitive retries need durable idempotency

- **Status:** Verified general principle; individual flow verification required
- **Subsystem:** billing / webhooks / async jobs
- **Observed symptom:** Replaying work can repeat business side effects if deduplication exists only in process memory.
- **Expected behavior:** A duplicate verified event produces at most one durable business effect.
- **Actual behavior:** In-memory deduplication does not reliably survive restarts or concurrent instances.
- **Root cause and evidence:** The deduplication boundary is not durable and atomic with the business mutation.
- **Corrective action:** Use a durable event key and transactional claim/effect processing; verify provider signatures before processing.
- **Regression proof:** Replay the same signed test event and assert one credit/invoice mutation; test concurrent duplicate delivery.
- **Affected paths:** Webhook and crediting handlers, tests, durable event store.
- **Verification:** Per-flow replay tests still required before marking a specific implementation verified.
- **Sandbox boundary:** Stripe test mode and emulator/test DB only.
- **Related issue/PR:** Issue #4; relevant Stripe hardening PR must stay unmerged until CI and test-mode replay pass.
- **Reusable rule:** Never automatically retry a side-effecting operation without durable idempotency and an observable test.
