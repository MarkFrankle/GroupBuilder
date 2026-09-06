# Backlog

Ideas, feature requests, and wishlist items. Not prioritized, not committed to.

## Feature Requests

- **New facilitator welcome page** — First-time facilitators (no programs/rosters yet, or `has_seen_welcome` flag) see a welcome landing page with two paths: "Learn how it works" → Help page, "Get started" → Roster/program creation. Returning facilitators skip straight to their normal flow. (Requested by admin user feedback, 2026-02) **DONE**
- **Linked partners (keep-together)** — Allow marking two participants as "linked" so the solver keeps them at the same table (opposite of the current partner/couple behavior which separates them). Use case: a couple where one needs the other for health reasons (has come up multiple times in BBT programs). UX idea: inline toggle icon inside the partner cell (only visible when a partner is selected). Two icons — one showing two figures at the same table (keep together), one showing two figures at separate tables (separate, default). Click to toggle, auto-syncs both partners. Tooltip on hover explains the behavior. No new column needed. Solver would add a same-table constraint instead of different-table. Until implemented, users can leave them unmarked and manually place them together after generating. (Requested by stakeholder feedback, 2026-02) **DONE**
- **Google Drive file picker** — Allow direct file selection from Google Drive instead of download-then-upload. Uses Google Picker API (client-side only, no Drive access). Low priority — current upload flow works fine. (Requested by user, 2026-02)
- **TanStack Query for client-side caching** — Replace manual useEffect/useState fetch pattern with TanStack Query for stale-while-revalidate caching. Pages show cached data instantly on revisit, background refetch keeps data fresh. Mechanical refactor across ~5-6 page components. Biggest quick win for perceived performance. (2026-02) **DONE**

- **Local storage backend for localhost** — Dev mode currently hits live Firestore. Add a local storage option (Firebase emulator suite or in-memory mock) for localhost development to avoid unnecessary Firestore reads/writes and speed up local iteration. (2026-02) **DONE**

- **Roster table truncation with long names** — When partner names are long (e.g., "Christopher Montgomery-Wellington"), the Partner column truncates aggressively ("Christopher...") because the column is fixed at 200px and shares space with the link/unlink icon. The Name column also truncates. Tried: (1) `min-w-0` on SelectTrigger — helps prevent layout breakage but doesn't give more space; (2) flexible column widths (`min-w-[160px]` instead of `w-[200px]`) — causes column jitter when selecting partners, worse UX. Probably needs a different approach: wider partner column, responsive table, or tooltip on hover showing full name. Low priority — BBT roster has normal-length names. (2026-02)

- ~~**User-friendly frontend error messages**~~ — Done (PR #91). Network errors and 5xx now show friendly messages; technical details logged to console. (2026-02)

- ~~**Improve Regenerate All Sessions modal copy**~~ — OBSOLETE (2026-09): full regeneration is being removed entirely. See `agent_docs/product-model.md`. Original note: — Current copy undersells destruction: says "a completely new set of assignments" and "your current version will be saved" without explicitly naming that saved absences are lost. Should say so plainly. (2026-06)

- **Worked examples in Help page** — FOLDED INTO the HelpPage rewrite in the 2026-09 redesign; scenarios (2) and (3) are now first-class flows rather than workarounds. Original note: — Three real mid-flight scenarios users struggle with: (1) saving absences then regenerating a session, (2) discovering partner/linking requirements after sessions are generated, (3) discovering participants need to be separated after sessions are generated. Show the step-by-step correct flow for each. (2026-06)

## Chores

- **Custom SMTP for Firebase Auth emails** — Firebase's sign-in link email template is non-editable (body is hardcoded, shows project ID "group-builder-backend" as app name). Custom domain (`noreply@group-builder.com`) and SPF/DKIM are already configured. To customize the email content: configure SMTP settings in Firebase Console → Authentication → Templates → SMTP settings to send through Resend. Then replace Firebase's `sendSignInLinkToEmail()` in `frontend/src/services/firebase.ts` with a backend endpoint that generates the sign-in link via Admin SDK (`generate_sign_in_with_email_link` — already used in `api/src/api/services/email_service.py` for invites) and sends a custom-branded email through Resend. Purely aesthetic — sign-in emails currently work and land in inbox. (2026-02)

- **Attribute focus switch** — Let the assignment view switch what the participant chips are *about*: religion (default), gender, or couples. One attribute at a time; per-table stats show all attributes regardless. Came from feedback that the colors are hard to read and icons might help. Part of the 2026-09 redesign. (2026-09)

- **Superlinear repeat penalty in the solver** — Repeats are currently penalized only within a rolling window (`pairing_window_size`, default 3), so a pair meeting in sessions 1, 4 and 5 is barely penalized and nothing counts total meetings per pair. Add a global per-pair repeat count with a superlinear penalty so a third meeting costs far more than a second. Chosen over a hard cap, which can make a program infeasible. (2026-09)

- **General keep-apart constraint** — Arbitrary pairs that must not share a table, alongside the existing linked-partners and couples-separation rules. Expect 0–1 pairs per program. Solver side should be close to existing couples separation; UI lives on the Setup page only. (2026-09)
