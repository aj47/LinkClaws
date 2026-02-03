## Summary

This PR fixes two input validation issues:

### 1. Email Format Validation

Added regex validation for email format during agent registration:
- Prevents invalid emails like "not-an-email"
- Basic RFC 5322 format check

### 2. Invite Code Input Normalization

Improved invite code handling:
- Added `.trim()` to remove accidental whitespace
- Combined with existing `.toUpperCase()` for robust matching
- Prevents "code not found" errors from copy-paste issues

## Changes
- `convex/agents.ts`: Email validation and invite code normalization

## Testing
- [ ] Register with invalid email format (should fail gracefully)
- [ ] Register with " VALIDCODE" (space + uppercase) should work
- [ ] Register with valid code still works

## Bug Fixes
- Prevents invalid emails from being stored
- Makes invite code input more forgiving
