# Harness²-Inspired Agent Improvement Plan

## Decision

Adopt Harness²'s research principles before adopting its runtime. QlipZync is currently a Node.js/TypeScript service; Harness² is a separate Python research harness. Do not add Harness² as a production dependency or connect it to production credentials as part of this initial change.

Upstream: https://github.com/google-research/harness2

## Adaptation map

| Harness area | Initial QlipZync implementation |
|---|---|
| System prompt | Repository-level agent/task instructions emphasizing minimal diffs and evidence |
| Guardrails | Sandbox-only rule, permission boundaries, bounded reruns, no secret logging |
| Memory | Version-controlled lessons library in `docs/engineering/lessons/` |
| Tool guidance | Explicit GitHub, CI, emulator, and test-mode operating rules |
| Subagents | Independent review passes for implementation, security, and verification where tools support them |
| Skills | Reusable task checklists for lockfiles, webhooks, CI, and deployment |
| Scripts | Existing reproducible CI commands, with no new automatic production side effects |
| Plugins / middleware | Explicitly scoped connector/tool permissions; credentials remain outside the repository |

## Recursive refinement protocol

For each bounded engineering task:

1. Retrieve up to a few highly relevant lessons; identify their verification status.
2. Capture baseline evidence (commit SHA, workflow run, exact failure and steps that actually executed).
3. Propose one falsifiable root-cause hypothesis and one minimal candidate patch.
4. Probe on an isolated branch using CI, emulators, or provider test mode only.
5. Compare baseline and candidate on the same runtime and test commands.
6. Compose only changes supported by evidence. Keep failed variants and negative findings visible.
7. Capture a lesson and link its proof to the issue/PR and exact commit/run.

## Budget and stopping conditions

- Initial baseline run.
- One targeted rerun after a concrete fix.
- At most one clean full-workflow rerun if the environment was stale or a targeted run cannot establish the overall result.
- If still failing, stop rerunning and inspect the new evidence rather than looping.
- Do not rerun side-effecting billing, publishing, webhook, or cloud operations without proven durable idempotency.
- Never use production deployment as a probe.
- Workflow queued/in-progress is not a successful result. Inspect the final status and exact SHA before promoting a lesson to Verified.

## First experiment: npm lockfile drift

Current observation: CI reports that `npm ci` cannot install because `package.json` and `package-lock.json` are out of sync. This is an install blocker; downstream build/test state is unknown for that run.

Procedure:
1. Reproduce from a clean checkout.
2. Capture the full error to identify the exact mismatch. Do not guess package versions.
3. Check relevant existing dependency changes and open PR diffs before editing shared files.
4. Regenerate the lockfile with the repository's expected npm version and peer-dependency flags; review rather than hand-edit the generated metadata.
5. Run clean install, lint/typecheck, production build, unit/integration tests, Firestore rules emulator tests, high/critical audit, Docker build and container smoke test.
6. Record every failed stage accurately and rerun within the bounded budget above.
7. Save final commit SHA, run URL, final status, and the lesson status.

## Acceptance criteria

- Lessons can be searched and consistently structured.
- Every verified finding points to executed proof and a final workflow result.
- Baseline and candidate are compared in isolation.
- Extra runs are bounded and their purpose is recorded.
- No production secrets or side effects are used for refinement.
- No PR is merged and no production deployment is triggered by this plan.
