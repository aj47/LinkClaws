# PR Rebase Guide for Issue #48

> **AI Agent Instructions**: This document contains structured tasks for rebasing diverged PRs.
> Execute tasks in order. Each task includes preconditions, commands, and verification steps.
> Tasks marked `[MAINTAINER]` can be executed with repo write access.
> Tasks marked `[EXTERNAL]` require contributor action - comment on PR with instructions.

## Quick Reference

| PR | Type | Branch | Commits to Cherry-pick | Expected Files |
|----|------|--------|----------------------|----------------|
| #23 | MAINTAINER | `claude/linkclaws-issue-10-v0IsL` | `3d3bf06`, `c84e0dd` | 12 files |
| #27 | MAINTAINER | `claude/linkclaws-issue-14-PjxUn` | `6af2290` | 4 files |
| #33 | EXTERNAL | `svsairevanth12:fix-issue-9` | N/A | ~3 files |
| #37 | EXTERNAL | `PierrunoYT:perf/feed-compound-indexes` | N/A | ~4 files |
| #38 | EXTERNAL | `PierrunoYT:feat/api-key-rotation` | N/A | ~5 files |
| #39 | CLOSE | N/A | N/A | Duplicate of #47 |

---

## Task 1: Close Duplicate PR #39 [MAINTAINER]

**Action**: Close PR as duplicate

```bash
# Execute this command:
gh pr close 39 --repo aj47/LinkClaws --comment "Closing as duplicate of #47 which has been merged. See issue #48 for details."
```

**Verification**:
```bash
gh pr view 39 --repo aj47/LinkClaws --json state -q '.state'
# Expected output: CLOSED
```

---

## Task 2: Rebase PR #23 - GDPR/CCPA Compliance [MAINTAINER]

**Preconditions**:
- Write access to `aj47/LinkClaws` repository
- Clean working directory

**Step 2.1: Fetch and create rebased branch**
```bash
git fetch origin main
git fetch origin claude/linkclaws-issue-10-v0IsL
git checkout -b pr23-rebased origin/main
```

**Step 2.2: Cherry-pick feature commits (in order)**
```bash
git cherry-pick 3d3bf06
git cherry-pick c84e0dd
```

**Step 2.3: Verify diff before push**
```bash
git diff --stat origin/main...HEAD
```

**Expected output** (must match approximately):
```
landing/PRIVACY.md                    | 291 +++
landing/convex/agents.ts              |  39 +-
landing/convex/compliance.ts          |  39 +++
landing/convex/compliance/consent.ts  | 131 +++
landing/convex/compliance/deletion.ts | 123 +++
landing/convex/compliance/export.ts   | 166 +++
landing/convex/compliance/helpers.ts  | 244 +++
landing/convex/compliance/privacy.ts  |  70 +++
landing/convex/crons.ts               |  62 +++
landing/convex/http.ts                | 263 +++
landing/convex/retention.ts           | 574 +++
landing/convex/schema.ts              | 152 +-
12 files changed, 2142 insertions(+), 12 deletions(-)
```

**Validation criteria**:
- File count: 12 files
- Total insertions: ~2142
- No unexpected files (especially no unrelated PRs' changes)

**Step 2.4: Force push to update PR** (requires confirmation)
```bash
git push --force-with-lease origin pr23-rebased:claude/linkclaws-issue-10-v0IsL
```

**Step 2.5: Cleanup**
```bash
git checkout main
git branch -D pr23-rebased
```

**Post-verification**:
```bash
gh pr view 23 --repo aj47/LinkClaws --json changedFiles -q '.changedFiles'
# Expected: 12
```

---

## Task 3: Rebase PR #27 - Agent Blocking [MAINTAINER]

**Preconditions**:
- Write access to `aj47/LinkClaws` repository
- Clean working directory

**Step 3.1: Fetch and create rebased branch**
```bash
git fetch origin main
git fetch origin claude/linkclaws-issue-14-PjxUn
git checkout -b pr27-rebased origin/main
```

**Step 3.2: Cherry-pick feature commit**
```bash
git cherry-pick 6af2290
```

**Step 3.3: Verify diff before push**
```bash
git diff --stat origin/main...HEAD
```

**Expected output** (must match exactly):
```
landing/convex/blocks.ts  | 220 +++
landing/convex/http.ts    | 166 +++
landing/convex/reports.ts | 193 +++
landing/convex/schema.ts  |  57 +-
4 files changed, 635 insertions(+), 1 deletion(-)
```

**Validation criteria**:
- File count: exactly 4 files
- Files must be: `blocks.ts`, `http.ts`, `reports.ts`, `schema.ts`
- Total insertions: ~635

**Step 3.4: Force push to update PR** (requires confirmation)
```bash
git push --force-with-lease origin pr27-rebased:claude/linkclaws-issue-14-PjxUn
```

**Step 3.5: Cleanup**
```bash
git checkout main
git branch -D pr27-rebased
```

**Post-verification**:
```bash
gh pr view 27 --repo aj47/LinkClaws --json changedFiles -q '.changedFiles'
# Expected: 4
```

---

## Task 4: Request Rebase for PR #33 [EXTERNAL]

**Action**: Comment on PR requesting contributor rebase

```bash
gh pr comment 33 --repo aj47/LinkClaws --body "$(cat <<'EOF'
Hi @svsairevanth12,

This PR has diverged from `main` and contains unrelated changes in the diff. Please rebase your branch:

```bash
git fetch upstream main
git checkout fix-issue-9
git rebase upstream/main
# Resolve any conflicts if they occur
git push --force-with-lease origin fix-issue-9
```

After rebasing, the PR should only show ~3 files changed with your email verification changes.

See issue #48 for more context.
EOF
)"
```

---

## Task 5: Request Rebase for PR #37 [EXTERNAL]

**Action**: Comment on PR requesting contributor rebase

```bash
gh pr comment 37 --repo aj47/LinkClaws --body "$(cat <<'EOF'
Hi @PierrunoYT,

This PR has diverged from `main` and contains unrelated changes in the diff. Please rebase your branch:

```bash
git fetch upstream main
git checkout perf/feed-compound-indexes
git rebase upstream/main
# Resolve any conflicts if they occur
git push --force-with-lease origin perf/feed-compound-indexes
```

After rebasing, the PR should only show ~4 files changed with your index changes.

See issue #48 for more context.
EOF
)"
```

---

## Task 6: Request Rebase for PR #38 [EXTERNAL]

**Action**: Comment on PR requesting contributor rebase

```bash
gh pr comment 38 --repo aj47/LinkClaws --body "$(cat <<'EOF'
Hi @PierrunoYT,

This PR has diverged from `main` and contains unrelated changes in the diff. Please rebase your branch:

```bash
git fetch upstream main
git checkout feat/api-key-rotation
git rebase upstream/main
# Resolve any conflicts if they occur
git push --force-with-lease origin feat/api-key-rotation
```

After rebasing, the PR should only show ~5 files changed with your API key rotation changes.

See issue #48 for more context.
EOF
)"
```

---

## Conflict Resolution Guide

If cherry-pick fails with conflicts:

1. Check which files have conflicts:
   ```bash
   git status
   ```

2. For each conflicted file, resolve conflicts manually keeping the feature changes

3. After resolving:
   ```bash
   git add <resolved-files>
   git cherry-pick --continue
   ```

4. If conflict is unresolvable, abort and report:
   ```bash
   git cherry-pick --abort
   ```

---

## Completion Checklist

After all tasks complete, verify:

```bash
# Check all PRs show expected file counts
gh pr view 23 --repo aj47/LinkClaws --json changedFiles -q '"PR #23: \(.changedFiles) files"'
gh pr view 27 --repo aj47/LinkClaws --json changedFiles -q '"PR #27: \(.changedFiles) files"'
gh pr view 33 --repo aj47/LinkClaws --json changedFiles -q '"PR #33: \(.changedFiles) files"'
gh pr view 37 --repo aj47/LinkClaws --json changedFiles -q '"PR #37: \(.changedFiles) files"'
gh pr view 38 --repo aj47/LinkClaws --json changedFiles -q '"PR #38: \(.changedFiles) files"'
gh pr view 39 --repo aj47/LinkClaws --json state -q '"PR #39: \(.state)"'
```

**Expected results**:
- PR #23: 12 files
- PR #27: 4 files
- PR #33: ~3 files (after contributor rebases)
- PR #37: ~4 files (after contributor rebases)
- PR #38: ~5 files (after contributor rebases)
- PR #39: CLOSED

---

## Metadata

```yaml
issue: 48
repository: aj47/LinkClaws
created: 2026-02-02
tasks_total: 6
tasks_maintainer: 3  # Tasks 1, 2, 3
tasks_external: 3    # Tasks 4, 5, 6
commits_verified:
  - hash: 3d3bf06
    message: "Implement data retention policies and privacy framework"
    pr: 23
  - hash: c84e0dd
    message: "Refactor compliance module into smaller focused files"
    pr: 23
  - hash: 6af2290
    message: "Add block/report agent API endpoints for content moderation"
    pr: 27
```
