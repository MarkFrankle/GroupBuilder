# Plan: Admin Help Page

**Date:** 2026-02-17
**Status:** Draft — awaiting review

---

## Background

The existing `HelpPage.tsx` is a well-structured single-page guide aimed at facilitators. It uses a consistent format: a table of contents, prose sections with headings, inline callout components (Tip, Warning, Info), and `<Screenshot>` figures with captions.

Admins have a separate role and a separate UI (the `/admin` route). Right now there is no documentation for that panel at all. Two things are conspicuously missing:

1. **Admin panel reference** — how to create and manage organizations, invite facilitators, revoke access, etc.
2. **Facilitator onboarding narrative** — what the invite email looks like, what the new facilitator will click, what to do if it goes wrong.

This plan covers what a new `AdminHelpPage` should contain, how it should be structured, and where it should live in the codebase.

---

## Scope

**In scope:**
- A new React page component, modeled structurally on `HelpPage.tsx`
- Routing and navigation so admins can reach it from the admin dashboard
- All content sections described below
- Identification of every screenshot that will be needed

**Out of scope:**
- Actually taking the screenshots (placeholders go in, real images added later)
- Changes to the facilitator-facing `HelpPage.tsx`
- Any backend changes

---

## Proposed File Location

```
frontend/src/pages/admin/AdminHelpPage.tsx
```

Reuse the same callout sub-components from `HelpPage.tsx`. Two options:

- **Option A (preferred):** Extract `TipCallout`, `WarningCallout`, `InfoCallout`, and `Screenshot` into a shared file (`frontend/src/components/HelpCallouts.tsx`) and import them into both pages.
- **Option B:** Copy them inline into `AdminHelpPage.tsx`. Simpler short-term, but creates duplication.

The shared extraction is worth it; the components are small and pure.

---

## Routing

Add a new route in `frontend/src/App.tsx`:

```
/admin/help  →  AdminHelpPage  (requires admin auth, same as /admin)
```

Add a link to it from `AdminDashboard.tsx` — either in the header nav or as a "?" help icon next to the page title. The exact placement is a UI decision left for implementation, but the link must be reachable without leaving the admin panel.

---

## Content Outline

The page should have eight sections. Each is described in enough detail below that a developer can write it without needing to re-examine the source code.

---

### 1. Getting Started as an Admin

**Purpose:** Orient someone who has just been granted admin access for the first time.

**What to cover:**
- What the admin panel is for: creating and managing *organizations* (each organization corresponds to one cohort/seminar series run by a set of facilitators).
- How admin access works: access is granted by adding an email to the `bb_admins` Firestore collection. This is done out-of-band (no self-service). Point the reader to whoever manages the system.
- How to reach the admin panel: navigate to `/admin` directly or use the Admin link if it appears in the nav. The admin panel is entirely separate from the facilitator UI.

**Callout:** `InfoCallout` explaining that admin access and facilitator access are independent — you can be an admin without being a member of any organization, and vice versa.

**Screenshot needed:** The admin dashboard at `/admin`, showing the Organizations list with a "+ Create Organization" button and the header with the logged-in email.

---

### 2. Creating an Organization

**Purpose:** Walk through the Create Organization flow step by step.

**What to cover:**

1. Click **"+ Create Organization"** from the dashboard.
2. **Series Name field** — this is the name facilitators will see when they log in and choose which cohort to work on. Use something specific: "Springfield Dialogue Series — Spring 2026" rather than just "Spring 2026". Max 100 characters.
3. **Facilitator Emails field** — enter one email address per line. These are the people who will receive invitations. You can add as many as you need. You don't have to invite everyone at creation time — you can add more later from the Manage screen.
4. Click **"Create & Send Invites."**
5. After creation, a confirmation screen appears showing each email address with a checkmark (sent) or an X (failed). If any failed, a manual invite link is shown — copy it and send it yourself.

**Warning callout:** If an email fails to send, the organization is still created and the facilitator still has an invite — it just wasn't emailed automatically. Don't re-create the organization. Use the manual link shown, or go to Manage → Add New Invite.

**Screenshot needed:** The Create Organization modal (form state), showing the Series Name field and the multi-line email textarea.

**Screenshot needed:** The post-creation confirmation screen, showing the sent/failed breakdown and the manual link for a failed invite.

---

### 3. Managing an Organization

**Purpose:** Explain the Manage modal — the primary day-to-day admin interface.

**What to cover:**

Click **"Manage"** on any organization card to open the management modal. It has two sections:

**Members** — People who have already accepted an invite and have active access. Each row shows their email, the date they joined, and their role. You can **Remove** a member at any time; they'll lose access to the organization immediately but can be re-invited later.

**Invites** — A full history of every invitation sent for this organization. Each invite shows:
- The invited email
- When it was sent
- The invite status:
  - **Pending** — sent but not yet accepted; expires on the date shown
  - **Accepted** — the person clicked the link and joined
  - **Expired** — the link was not used before the expiry date
  - **Revoked** — you cancelled it manually
  - **Removed** — the person was removed from the organization after accepting

You can **Revoke** any pending invite before it's accepted. Expired invites can't be used; you'd need to send a new one.

**Add New Invite** — At the top of the Invites section there's a single-email form. Enter an email and click "Send Invite" to add a new facilitator to an existing organization without going through the Create flow.

**Info callout:** Removing a member does not delete any of the work they did in the organization (roster edits, generated groups, etc.). It only removes their access.

**Screenshot needed:** The Manage modal showing both the Members section (with a Remove button) and the Invites section (showing a mix of statuses and a pending invite with a Revoke button), plus the Add New Invite form.

---

### 4. Deleting an Organization

**Purpose:** Explain what "Delete" does and when to use it.

**What to cover:**
- Click **"Delete"** on an organization card to soft-delete it. The organization disappears from the default list but all its data (roster, assignments, results) is preserved in the database.
- This is a soft delete. If you need to recover a deleted organization, contact whoever manages the backend.
- To see deleted organizations in the list, check **"Show deleted organizations"** at the top of the dashboard. Deleted orgs appear grayed-out with a "Deleted" badge. They cannot be managed or re-activated from the UI.
- You cannot delete an already-deleted organization (the Delete button is disabled for them).

**Warning callout:** There is no undo for this action. The confirmation dialog is the only safeguard. Double-check the name before clicking Delete.

**Screenshot needed:** The delete confirmation dialog for an organization.

---

### 5. Onboarding a New Facilitator: What They'll Experience

**Purpose:** Help admins set expectations and troubleshoot the facilitator's first login.

This is the most important section for reducing admin support burden. Describe the full flow from the facilitator's perspective:

1. **The invitation email** arrives from the system. It contains a "Sign in to GroupBuilder" link that is personalized to the invited email address. The link signs them in automatically — no password required.

2. **Clicking the link** takes them to the invite acceptance page at `/invite/<token>`. The system signs them in with Firebase magic-link auth in the background. Once signed in, they see a "You're Invited!" screen showing the organization name and the email they were invited as.

3. **Accept Invite** — They click the green button. A brief loading state, then a success message: "Invite Accepted!" They're automatically redirected to the main app.

4. **First time in the app** — They land on the Home page for the organization they just joined. If they were invited to multiple organizations, they'll see an organization selector first. From here, they use the app as described in the facilitator help page.

5. **Future logins** — The magic link in the invite email only works once. For subsequent logins, they go to the login page directly and enter their email to receive a fresh login link (valid for 60 minutes).

**Tip callout:** Tell new facilitators to bookmark the app after their first login — they won't need the invite email again.

**Callout for email mismatch scenario:** If a facilitator clicks the link but is already signed in to GroupBuilder with a *different* email, they'll see a warning and the Accept button will be disabled. They need to click "Sign In with Different Email" and use the address the invite was sent to.

**Screenshot needed:** The `/invite/<token>` accept page in the "logged in, ready to accept" state (showing org name, invited email, and the green Accept button).

---

### 6. Logins, Sharing, and Who Can See What

**Purpose:** Directly address admin anxiety about multiple people being logged in at once, and set clear expectations about the data isolation model.

**What to cover:**

**Each facilitator needs their own login.**
GroupBuilder uses email-based magic links — there are no passwords to share. This means each person who needs access must have their own email address in the system, and must log in via their own email. Sharing login credentials is not possible with this auth model; it's not a restriction, it's just how magic links work. If two people need access, invite both of them.

**Multiple facilitators can be logged in simultaneously — this is fine.**
There is no concept of "one person at a time." If two facilitators from the same organization both have the app open, both are looking at the same shared data: the same roster, the same generated groups, the same assignment history. Either of them can make changes. This is intentional — it supports co-facilitation and delegation.

**Facilitators only see their own organization's data.**
Access is scoped strictly to the organizations a facilitator has been invited to and accepted. A facilitator in "Spring 2026 Cohort" cannot see anything in "Fall 2025 Cohort" unless they were separately invited to that org. Admins can see all organizations in the admin panel, but only via the admin UI — the admin panel doesn't give roster or group access, only org management access.

**The expected ownership model.**
The typical setup is one facilitator per organization who "owns" the tool — they build the roster, run the solver, and manage the results. Additional facilitators can be invited (e.g., a co-facilitator or backup) and will have full equal access to the same org. There is no read-only role; all invited facilitators can edit.

**Tip callout:** If you're inviting a co-facilitator purely so they can view assignments (not edit), there's no lightweight way to do that right now. Anyone you invite gets full edit access. The workaround is to share a link to the results page using the Copy Link button in the app — no login required to view a shared link.

**Info callout:** Login links expire after 60 minutes. Facilitators who get logged out just need to go to the login page and enter their email to get a fresh link. Nothing is lost — their data lives in the database, not in their browser session.

**No screenshot needed for this section** — it's entirely explanatory prose.

---

### 7. Common Admin Tasks (Quick Reference)

A tight reference table or bulleted list of the most frequent tasks:

| Task | Where to do it |
|---|---|
| Create a new cohort | Dashboard → "+ Create Organization" |
| Add a facilitator to an existing cohort | Dashboard → Manage → Add New Invite |
| See if a facilitator accepted their invite | Dashboard → Manage → Invites (check status) |
| Re-send an invite (if expired) | Dashboard → Manage → Add New Invite (same email) |
| Remove a facilitator's access | Dashboard → Manage → Members → Remove |
| Cancel an invite before it's accepted | Dashboard → Manage → Invites → Revoke |
| See soft-deleted organizations | Dashboard → check "Show deleted organizations" |

---

### 8. Troubleshooting

Individual `InfoCallout` blocks, matching the style of `HelpPage.tsx`:

- **"An invite email failed to send"** — The organization was still created and the invite link exists. Use the manual link shown in the post-creation dialog, or go to Manage → Add New Invite with the same address.

- **"A facilitator says the link doesn't work"** — Invite links expire after 7 days. Check the status in Manage → Invites. If it's Expired, send a new invite using Add New Invite.

- **"A facilitator is signed in but can't see the organization"** — They may not have clicked Accept Invite. Send them the invite link again (Manage → Invites — the invite link itself is not exposed in the UI, so you'll need to send a new invite via Add New Invite, or have them check their original email).

- **"A facilitator clicked the link but got a 'wrong email' warning"** — They were already signed into GroupBuilder with a different email. They need to click "Sign In with Different Email" on the invite page and sign in using the email the invite was sent to.

- **"I can't find an organization I created"** — Check "Show deleted organizations" on the dashboard. If it appears there, it was soft-deleted. Data is intact; UI recovery isn't currently supported.

- **"Two facilitators edited the roster at the same time and something looks wrong"** — The app has no real-time conflict detection. If two people are editing the roster simultaneously, the last write wins. If something looks off, check the roster and correct it manually. For anything consequential (running the solver, making manual edits to assignments), coordinate so only one person is doing it at a time.

- **"I need admin access"** — Admin access requires adding your email to the `bb_admins` collection in Firestore. Contact your system administrator.

---

## Screenshots Summary

All screenshots should go in `public/images/admin-help/`. Use the same `<Screenshot>` component as the facilitator help page.

| Filename | What it shows |
|---|---|
| `admin-dashboard.png` | Dashboard with org list, "+ Create Organization" button, "Show deleted" checkbox |
| `create-org-modal.png` | Create modal, form state, with Series Name and Facilitator Emails filled in |
| `create-org-success.png` | Post-creation confirmation showing sent ✓ and failed ✗ with manual link |
| `manage-org-modal.png` | Manage modal showing Members, Invites (mixed statuses), and Add New Invite form |
| `delete-org-dialog.png` | Confirmation dialog for deleting an organization |
| `invite-accept-page.png` | The `/invite/<token>` page in the "logged in, ready to accept" state |

Screenshots can be stubbed with placeholder images initially and filled in as a separate task.

---

## Implementation Notes

- The page is static content only — no API calls, no state. Implementation is straightforward.
- Recheck `AdminDashboard.tsx` and the modals before writing final copy to catch any UI text that has drifted from what's described here.
- After implementation, run `npm run lint` and `npx tsc --noEmit` in `frontend/` per CLAUDE.md.
- No backend changes required.
- The "Show deleted organizations" toggle currently labels deleted orgs as "Deleted" in the UI with a grayed-out card — confirm this matches the actual rendered output before writing that section's copy.
