# Lessons Library

Store task-specific findings in this directory using `LESSON-YYYY-MM-DD-NNN-short-title.md`. Keep general labeling and workflow policy in [Behavioral labels and lessons](../behavioral-labels-and-lessons.md).

## Required lifecycle

1. **Retrieve:** Search existing lessons before changing code. Note relevant lesson IDs in the issue/PR.
2. **Baseline:** Record the exact error, commit SHA, environment, and which steps did or did not run.
3. **Propose:** State one falsifiable hypothesis and the smallest safe change.
4. **Probe:** Validate on an isolated branch with a bounded run budget. Keep test data, credentials, queues, and external providers in sandbox/test mode.
5. **Compare:** Run equivalent baseline/candidate checks. Preserve logs and exact final status; redact secrets.
6. **Compose:** Adopt only changes supported by observable evidence. Record abandoned hypotheses and negative results.
7. **Learn:** Add a lesson, link the issue/PR and CI run, and use `learning:lesson-captured`. Mark prior lessons as applied only when they changed the plan or implementation.

## Task checklist

- [ ] Relevant lessons searched and linked
- [ ] Baseline commit and failure captured
- [ ] Expected behavior and measurable pass criteria defined
- [ ] Proposed change kept minimal and on a non-production branch
- [ ] Side effects identified; durable idempotency verified before replay
- [ ] Sandbox/test-mode boundary stated
- [ ] Rerun budget recorded (baseline + targeted rerun + at most one clean full workflow rerun)
- [ ] Exact commit SHA and final CI status confirmed
- [ ] Results distinguish verified findings from hypotheses
- [ ] Reusable lesson saved and linked

## Template

Copy to a new lesson file:

```markdown
# LESSON-YYYY-MM-DD-NNN — Title

- **Status:** Verified | Hypothesis
- **Subsystem:**
- **Observed symptom:**
- **Expected behavior:**
- **Actual behavior:**
- **Root cause and evidence:**
- **Corrective action:**
- **Regression proof:**
- **Affected paths:**
- **Verification:** commit SHA, workflow/run URL, final status, reruns
- **Sandbox boundary:**
- **Related issue/PR:**
- **Reusable rule:**
```

## Evidence bar

A lesson is **Verified** only when its stated proof was actually executed and its final result inspected. A proposed fix, successful code write, green partial job, mock response, or in-progress workflow is not end-to-end verification. Do not record secrets, tokens, private keys, or full customer data.
