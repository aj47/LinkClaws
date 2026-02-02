# PR Rebase Guide for Issue #48

This document provides rebase instructions for the PRs identified in issue #48 as having diverged from the main branch.

## Issue Summary

Multiple PRs show significant divergence from `main` due to merge commits that include unrelated changes. The recommended priority order for rebasing is: #33 → #23 → #38 → #27 → #37

## PR Status and Rebase Instructions

### PR #33 - Email Verification Security (External Fork)
- **Branch:** `fix-issue-9` (from svsairevanth12/LinkClaws)
- **Status:** External contributor fork - requires contributor action
- **Action Required:** @svsairevanth12 needs to rebase their branch

```bash
# Commands for contributor to run in their fork:
git fetch upstream main
git checkout fix-issue-9
git rebase upstream/main
# Resolve any conflicts
git push --force-with-lease origin fix-issue-9
```

---

### PR #23 - GDPR/CCPA Compliance (Internal)
- **Branch:** `claude/linkclaws-issue-10-v0IsL`
- **Actual Feature Commits:**
  - `3d3bf06` - Implement data retention policies and privacy framework
  - `c84e0dd` - Refactor compliance module into smaller focused files
- **Files Changed:** 13 files with compliance/privacy features

**Rebase Instructions:**
```bash
# Create clean rebased branch
git fetch origin main
git checkout -b claude/linkclaws-issue-10-v0IsL-rebased origin/main

# Cherry-pick only the feature commits (in order)
git cherry-pick 3d3bf06
git cherry-pick c84e0dd

# Resolve any conflicts, then force push
git push --force-with-lease origin claude/linkclaws-issue-10-v0IsL-rebased:claude/linkclaws-issue-10-v0IsL
```

---

### PR #38 - API Key Rotation (External Fork)
- **Branch:** `feat/api-key-rotation` (from PierrunoYT/LinkClaws)
- **Status:** External contributor fork - requires contributor action
- **Action Required:** @PierrunoYT needs to rebase their branch

```bash
# Commands for contributor to run in their fork:
git fetch upstream main
git checkout feat/api-key-rotation
git rebase upstream/main
# Resolve any conflicts
git push --force-with-lease origin feat/api-key-rotation
```

---

### PR #27 - Agent Blocking (Internal)
- **Branch:** `claude/linkclaws-issue-14-PjxUn`
- **Actual Feature Commits:**
  - `6af2290` - Add block/report agent API endpoints for content moderation
- **Files Changed:** 4 files (blocks.ts, http.ts, reports.ts, schema.ts)

**Rebase Instructions:**
```bash
# Create clean rebased branch
git fetch origin main
git checkout -b claude/linkclaws-issue-14-PjxUn-rebased origin/main

# Cherry-pick only the feature commit
git cherry-pick 6af2290

# Resolve any conflicts, then force push
git push --force-with-lease origin claude/linkclaws-issue-14-PjxUn-rebased:claude/linkclaws-issue-14-PjxUn
```

---

### PR #37 - Feed Compound Indexes (External Fork)
- **Branch:** `perf/feed-compound-indexes` (from PierrunoYT/LinkClaws)
- **Status:** External contributor fork - requires contributor action
- **Action Required:** @PierrunoYT needs to rebase their branch

```bash
# Commands for contributor to run in their fork:
git fetch upstream main
git checkout perf/feed-compound-indexes
git rebase upstream/main
# Resolve any conflicts
git push --force-with-lease origin perf/feed-compound-indexes
```

---

## Additional Notes

### PR #39 - Duplicate of #47
PR #39 (clickable followers/following lists) is a duplicate of PR #47 which has already been merged. PR #39 should be closed.

### General Rebase Tips

1. Always use `--force-with-lease` instead of `--force` to prevent overwriting others' work
2. If conflicts occur during cherry-pick, resolve them and run `git cherry-pick --continue`
3. After rebasing, the PR diff should only show the intended changes
4. If unsure about conflict resolution, reach out to maintainers

### Verification After Rebase

After rebasing, verify the PR shows only the expected changes:
- PR #23: Should show ~12 files changed (compliance, retention, privacy features)
- PR #27: Should show 4 files changed (blocks, reports, http, schema)
- PR #33: Should show ~3 files (email verification changes)
- PR #37: Should show ~4 files (index changes)
- PR #38: Should show ~5 files (API key rotation)

## Verified Rebase Results

The following rebases were tested locally and verified to work correctly:

### PR #23 - Verified Clean Rebase
Cherry-picking commits `3d3bf06` and `c84e0dd` onto current main produces:
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

### PR #27 - Verified Clean Rebase
Cherry-picking commit `6af2290` onto current main produces:
```
landing/convex/blocks.ts  | 220 +++
landing/convex/http.ts    | 166 +++
landing/convex/reports.ts | 193 +++
landing/convex/schema.ts  |  57 +-
4 files changed, 635 insertions(+), 1 deletion(-)
```

These results confirm the rebase process eliminates the spurious changes from merge commits.
