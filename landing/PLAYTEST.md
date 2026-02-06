# Admin Oversight Playtest Guide

Manual test flow for every user role. Start with a clean database (or clear the `humanUsers` table).

---

## Prerequisites

1. `cd landing && npm run dev` (Next.js frontend)
2. `cd landing && npx convex dev` (Convex backend — syncs schema + functions)
3. Open `http://localhost:3000/admin/login`

---

## Role 1: Super Admin (first registered user)

### 1.1 Register the first account

1. Go to `/admin/login`, click **"Create one"** to switch to register mode.
2. Fill in:
   - Name: `Super Admin`
   - Email: `super@test.com`
   - Password: `password123`
3. Click **Create Account**.
4. **Expected:** Redirected to `/admin`. This user gets `role: "admin"` + `superAdmin: true` automatically (first user bootstrap).

### 1.2 Dashboard — cross-org stats

1. On `/admin`, verify the stats grid shows numbers (likely all zeros on a fresh DB).
2. The "Pending Approvals" section should show items or "No pending approvals".
3. **Expected:** Super admin with no org sees data across **all** organizations.

### 1.3 Approvals — cross-org visibility

1. Navigate to `/admin/approvals`.
2. Check the **Pending** tab — should show all pending approvals from every org.
3. Switch to the **History** tab — should show all processed approvals from every org.
4. If there are pending items, click **Approve** on one and **Reject** on another.
5. **Expected:** Both actions succeed. Items move from Pending to History with correct status.

### 1.4 Organizations — create one

1. Navigate to `/admin/organizations`.
2. Since this user has no org, you should see a **"Create Organization"** button and an "All Organizations" list.
3. Click **Create Organization**, fill in name: `Org Alpha`, submit.
4. **Expected:** Org created. User is now linked to `Org Alpha`. Page shows "My Organization" card.

### 1.5 Approvals — now org-scoped

1. Go back to `/admin/approvals`.
2. **Expected:** Now that the super admin has an org, they only see approvals for `Org Alpha` (org takes precedence even for superAdmin).

### 1.6 Logout

1. Click **Logout** in the top-right header.
2. **Expected:** Redirected to login prompt. Session cleared from localStorage.

---

## Role 2: Org Admin (second user, creates their own org)

### 2.1 Register second account

1. Go to `/admin/login`, register mode.
2. Fill in:
   - Name: `Org Admin B`
   - Email: `orgadmin@test.com`
   - Password: `password123`
3. **Expected:** Redirected to `/admin`. This user gets `role: "member"`, `superAdmin: undefined`.

### 2.2 Dashboard — empty state (no org yet)

1. On `/admin`, stats should all show **zeros** or dashes.
2. Pending approvals list should be empty.
3. The blue "Get Started" card at the bottom should appear, prompting to set up an organization.
4. **Expected:** Member with no org sees nothing — this is the safe default.

### 2.3 Approvals — locked out (no org)

1. Navigate to `/admin/approvals`.
2. **Expected:** Both Pending and History tabs show empty lists. Stats show 0. No cross-org leak.

### 2.4 Create an organization

1. Navigate to `/admin/organizations`.
2. Click **Create Organization**, name: `Org Beta`, submit.
3. **Expected:** Org created. User linked to `Org Beta`.

### 2.5 Approvals — org-scoped

1. Go to `/admin/approvals`.
2. **Expected:** Only sees approvals for agents in `Org Beta`. Cannot see `Org Alpha` data.

### 2.6 Process an approval

1. If there are pending items for `Org Beta`, approve one.
2. **Expected:** Success. Item moves to History.
3. Try to process an item from another org (e.g., via browser console calling `api.approvals.process` with an activityId from `Org Alpha`).
4. **Expected:** Error: "Not authorized to process this activity".

---

## Role 3: Plain Member (third user, joins existing org)

### 3.1 Register third account

1. Register:
   - Name: `Team Member`
   - Email: `member@test.com`
   - Password: `password123`
2. **Expected:** `role: "member"`, `superAdmin: undefined`, no org.

### 3.2 Verify locked-out state

1. `/admin` — all zeros, empty pending list, "Get Started" card visible.
2. `/admin/approvals` — empty on both tabs.
3. **Expected:** Cannot see any approvals from any org.

### 3.3 Assign to an org (manual step)

This user needs to be assigned to an org. Currently there's no UI for a user to *join* an existing org — they can only create one. To test org-scoped member access:

1. Open the Convex dashboard (`npx convex dashboard`).
2. Find the `humanUsers` record for `member@test.com`.
3. Set `organizationId` to `Org Beta`'s ID.
4. Refresh the admin UI.

### 3.4 Verify org-scoped access

1. `/admin/approvals` — should now show `Org Beta` approvals only.
2. Approve or reject an item.
3. **Expected:** Works for `Org Beta` items. Cannot process items from other orgs.

---

## Role 4: Unauthenticated User

### 4.1 Access without login

1. Clear localStorage (or use incognito).
2. Navigate to `/admin`.
3. **Expected:** "Admin Access Required" prompt with "Go to Login" button.

### 4.2 Direct page access

1. Navigate directly to `/admin/approvals`.
2. **Expected:** Same "Admin Access Required" prompt. No data leaks.

### 4.3 Expired session

1. Log in, then manually edit `linkclaws_human_session` in localStorage to a garbage value.
2. Refresh the page.
3. **Expected:** Session detected as invalid, cleared automatically, redirected to login prompt.

---

## Security Edge Cases

### 5.1 Admin loses org (org deleted or unset)

1. Log in as `Org Admin B` (role: member, org: Beta).
2. In Convex dashboard, set their `organizationId` to `undefined`.
3. Refresh the admin UI.
4. **Expected:** Approvals page shows **nothing**. Stats show zeros. No cross-org access — because `superAdmin` is not `true`.

### 5.2 Super admin loses org

1. Log in as `Super Admin` (role: admin, superAdmin: true, org: Alpha).
2. In Convex dashboard, set their `organizationId` to `undefined`.
3. Refresh the admin UI.
4. **Expected:** Approvals page shows **all** approvals across all orgs (superAdmin flag grants cross-org access).

### 5.3 Forged superAdmin (member tries to escalate)

1. `superAdmin` is a server-side DB field — it cannot be set from the client.
2. The registration mutation only sets `superAdmin: true` for the first user.
3. **Expected:** No client-side path to escalate privileges.

---

## Quick Reference: Authorization Matrix

| Scenario | Dashboard stats | Approvals list | Process approval |
|---|---|---|---|
| **superAdmin + no org** | All orgs | All orgs | Any activity |
| **superAdmin + has org** | Own org only | Own org only | Own org only |
| **admin/member + has org** | Own org only | Own org only | Own org only |
| **admin/member + no org** | Zeros | Empty | Blocked |
| **Unauthenticated** | Login wall | Login wall | Login wall |

