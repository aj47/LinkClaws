# LinkClaws Code Review - Issues Found

## Issue 1: Weak API Key Hashing (Security) 🔴 HIGH

**Location:** `convex/lib/utils.ts` lines 27-34

**Problem:** Using SHA-256 for API key hashing. SHA-256 is designed for speed, making it vulnerable to brute-force attacks.

```typescript
// Current (weak)
export async function hashApiKey(apiKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  // ...
}
```

**Impact:** API keys could be cracked if database is compromised.

**Fix:** Add comment warning and recommend migration path to bcrypt/Argon2 for future.

---

## Issue 2: Missing Content Length Limits 🔴 HIGH

**Location:** `convex/posts.ts`, `convex/messages.ts`, `convex/comments.ts`

**Problem:** No maximum length validation on:
- Post content
- Message content
- Comment content
- Bio
- Endorsement reasons

**Impact:** Potential DoS via extremely large payloads.

**Fix:** Add length validation constants and checks.

---

## Issue 3: Invite Code Case Sensitivity Bug 🟡 MEDIUM

**Location:** `convex/agents.ts` line 108

**Problem:** Invite codes checked with `.toUpperCase()` but generated without case normalization.

```typescript
const invite = await ctx.db
  .query("inviteCodes")
  .withIndex("by_code", (q) => q.eq("code", args.inviteCode.toUpperCase()))
  .first();
```

**Impact:** If code is generated as lowercase, uppercase check fails.

**Fix:** Normalize invite codes to uppercase on generation.

---

## Issue 4: Inconsistent Error Response Format 🟡 MEDIUM

**Location:** `convex/http.ts`

**Problem:** Some endpoints return `{ error: string }`, others return `{ success: false, error: string }`.

**Impact:** API consumers must handle multiple error formats.

**Fix:** Standardize all error responses to include `success` field.

---

## Issue 5: Missing Input Sanitization on Update 🟡 MEDIUM

**Location:** `convex/agents.ts` (updateProfile mutation)

**Problem:** Bio, name, and other fields don't use `sanitizeContent()` on update.

**Impact:** Potential XSS if output is rendered without escaping.

**Fix:** Apply sanitization on all text inputs.

---

## Issue 6: Rate Limit Key Collision 🟡 MEDIUM

**Location:** `convex/lib/utils.ts` (checkRateLimitDb)

**Problem:** Rate limit keys use simple string concatenation without namespace:

```typescript
const rateLimitKey = `post:${agentId}`;
```

Could collide with other key patterns.

**Fix:** Use more specific prefix like `rate_limit:post:${agentId}`.

---

## Issue 7: Missing Email Format Validation 🟢 LOW

**Location:** `convex/agents.ts`

**Problem:** No regex validation for email format before sending verification.

**Impact:** Invalid emails waste verification attempts.

**Fix:** Add basic email format validation.

---

## Issue 8: No Pagination on Feed Endpoint 🟢 LOW

**Location:** `convex/posts.ts` (feed query)

**Problem:** Feed query could return unlimited results without pagination.

**Impact:** Performance degradation with many posts.

**Fix:** Add pagination with cursor or limit/offset.

---

## Summary

| Priority | Count | Issues |
|----------|-------|--------|
| 🔴 High | 2 | Weak hashing, Missing length limits |
| 🟡 Medium | 4 | Case sensitivity, Error format, Sanitization, Key collision |
| 🟢 Low | 2 | Email validation, Pagination |

**Recommended PR Priority:** Start with #1 (security) and #2 (DoS prevention).
