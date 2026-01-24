# Multi-Tenant Authentication & Authorization Design

**Date:** 2026-01-18
**Status:** Design Phase
**Budget Constraint:** <€100/year total infrastructure cost

## Problem Statement

GroupBuilder currently uses "security by obscurity" - session UUIDs are the only access control mechanism. This creates several risks for interfaith seminar participants:

### Security Gaps
- **Link leakage:** If a results URL is forwarded to public lists, anyone can access participant names + religious affiliations
- **No revocation:** Once a link is shared, there's no way to revoke access (except manual Upstash deletion)
- **No audit trail:** No visibility into who accessed what data or when
- **Persistent access:** Links work for 30 days with no ability to expire them early

### Threat Model
- **Primary concern:** Protecting interfaith seminar participants from targeted harassment
- **Attack vectors:** Social engineering, accidental link sharing, malicious forwarding
- **Data at risk:** Participant names + religious affiliation (sufficient for harassment campaigns)
- **NOT concerned with:** Brute-force UUID guessing (cryptographically infeasible)

### Business Context
- **Customer:** Building Bridges nonprofit sells seminar series to local faith organizations
- **Users:** 6 facilitators per series instance (2 from each of 3 faith communities)
- **Scale:** ~10-20 series instances running simultaneously across the US
- **Data retention need:** 60+ days (prep time + 6 weekly sessions)
- **Current TTL:** 30 days (too short for actual use case)

## Solution Overview

**Core Architecture:** Firebase Auth (passwordless) + Firestore (multi-tenant data) + existing Upstash Redis (temporary uploads)

**Key Principles:**
1. **Zero password storage** - Use Firebase Auth, never touch credentials ourselves
2. **Org-scoped link sharing** - Links only work if you're authenticated to the right organization
3. **Minimal UX change** - Facilitators use the app exactly like before (after one-time login)
4. **Zero new infrastructure costs** - Fits entirely within Firebase free tier

## Architecture

### Component Responsibilities

**Firebase Auth (Identity Layer):**
- ✅ Magic link email delivery
- ✅ Session token generation/validation
- ✅ Account security (breach detection, etc.)
- ✅ User profile storage (email, display name)

**Firestore (Multi-Tenant Data Layer):**
- ✅ Organizations (seminar series instances)
- ✅ Organization memberships (who belongs to which org)
- ✅ Session metadata (which org owns which session)
- ✅ Long-term assignment results (60+ day retention)

**Upstash Redis (Temporary Storage):**
- ✅ Upload session data (1 hour TTL, unchanged from current)
- ✅ High-speed caching

**FastAPI Backend (Authorization Layer):**
- ✅ Verify Firebase tokens on every request
- ✅ Enforce org-based access control ("does user belong to session's org?")
- ✅ Business logic (solver, API endpoints)

**React Frontend (UI Layer):**
- ✅ Login page (email input + magic link button)
- ✅ Session dashboard (view org's previous sessions)
- ✅ Current upload/results pages (minimally modified)

### Data Flow

```
1. User visits groupbuilder.com/results?session=abc-123
2. Frontend: Not authenticated → redirect to /login?redirect=/results?session=abc-123
3. User enters email → Firebase Auth sends magic link
4. User clicks link → Firebase creates session → Frontend gets ID token
5. Frontend redirects to /results?session=abc-123 with token
6. Every API request includes: Authorization: Bearer <firebase-token>
7. FastAPI middleware:
   a. Verify token with Firebase Admin SDK → get user_id
   b. Query Firestore: "Which org does user_id belong to?"
   c. Query Firestore: "Which org owns session abc-123?"
   d. If same org → allow request
   e. If different org → return 403 Forbidden
```

## Data Model

### Firestore Schema

**Collections Structure:**
```
organizations/
  {org_id}/
    name: "Austin BB March 2026"
    created_at: timestamp
    created_by: user_id

    members/ (subcollection)
      {user_id}/
        email: "facilitator@austin-mosque.org"
        role: "facilitator" | "admin" | "bb_admin"
        invited_at: timestamp
        joined_at: timestamp

    sessions/ (subcollection)
      {session_id}/
        created_by: user_id
        created_at: timestamp
        filename: "participants.xlsx"
        num_tables: 4
        num_sessions: 6
        participant_data: {...}  // migrated from Redis

    results/ (subcollection)
      {session_id}/
        versions/ (subcollection)
          {version_id}/
            created_at: timestamp
            assignments: {...}
            metadata: {...}
```

### Roles

**Three role types:**
- **`facilitator`:** Can upload files, generate assignments, view all org sessions (default for invited users)
- **`admin`:** Same as facilitator (reserved for future use if needed)
- **`bb_admin`:** Building Bridges staff - god mode, can see all orgs (for support/troubleshooting)

**For MVP:** Everyone is a `facilitator`. Role distinctions exist in schema for future flexibility.

### Access Control Rules

**Simple authorization logic:**
```python
def user_can_access_session(user_id: str, session_id: str) -> bool:
    # Get user's organization(s)
    user_orgs = firestore.collection('organizations')
                        .where('members', 'array_contains', user_id)
                        .get()

    # Get session's organization
    session = firestore.collection_group('sessions')
                       .document(session_id)
                       .get()

    # Check if user belongs to session's org
    return session.parent.parent.id in [org.id for org in user_orgs]
```

## User Flows

### First-Time Facilitator Onboarding

1. **Building Bridges staff creates org** (via admin panel - see next section)
2. **BB staff invites facilitators** (enters 6 email addresses)
3. **Facilitator receives invite email:**
   ```
   Subject: You've been invited to Austin BB March 2026 on GroupBuilder

   Sarah from Building Bridges invited you to collaborate on
   Austin BB March 2026.

   Click here to get started: [Accept Invite]

   This link expires in 7 days.
   ```
4. **Facilitator clicks "Accept Invite"** → lands on signup page
   - Email pre-filled from invite token
   - Button: "Send me a login link"
5. **Firebase sends magic link email:**
   ```
   Subject: Sign in to GroupBuilder

   Click here to sign in: [Sign In]

   This link expires in 60 minutes.
   ```
6. **Facilitator clicks magic link** → authenticated + auto-joined to org → lands on main page
7. **Total clicks:** 3 (accept invite, send login link, click magic link)

### Returning User Login

**Scenario 1: Direct visit to groupbuilder.com**
1. Sees login page (email input)
2. Enters email → clicks "Send magic link"
3. Checks email → clicks link
4. Authenticated → lands on main page

**Scenario 2: Bookmarked session URL** (most common)
1. Clicks bookmark: `groupbuilder.com/results?session=abc-123`
2. Redirected to login page (session ID preserved in URL)
3. Enters email → magic link flow
4. Authenticated → **auto-redirected back to bookmarked session**

**Session duration:** Firebase session cookies last 30-60 days, so facilitators only need to log in once per browser.

### Creating & Sharing Assignments

**Creating (unchanged from current UX):**
1. Facilitator logs in → sees main page
2. Uploads Excel file (stored temporarily in Redis, 1 hour TTL)
3. Generates assignments → stored in Firestore under their org
4. Views results → copies URL: `groupbuilder.com/results?session=abc-123`

**Sharing with co-facilitators:**
1. Facilitator A shares URL with Facilitator B (same org) via email/Slack
2. Facilitator B clicks link:
   - If already logged in → immediately sees results ✅
   - If not logged in → login page → magic link → sees results ✅
3. Bay Area facilitator somehow gets the Austin link:
   - Clicks link → logs in as Bay Area org member
   - Backend checks: "Austin session != Bay Area org"
   - Returns 403 Forbidden ❌

### Viewing Previous Sessions

**Main page additions (minimal):**
- **Top bar:** Small org badge "Austin BB March 2026" + profile icon (log out)
- **Below upload form:** Collapsible section "Previous Sessions"
  ```
  ▼ Previous Sessions (5)
    • Session 1 - Created Jan 15 by Sarah - 24 participants
    • Session 2 - Created Jan 18 by Ahmed - 24 participants
    • Session 3 - Created Jan 20 by You - 24 participants
  ```
- Click a session → navigate to results page
- **Bookmarks still work** - this is just for discoverability

## What We're NOT Building

**No granular sharing controls:**
- ❌ "Share this session with Bob but not Alice"
- ❌ Public vs private session toggles
- ❌ "Request access" workflows
- ❌ Different permission levels within an org

**No password management:**
- ❌ Password storage/hashing
- ❌ Password reset flows
- ❌ Multi-factor authentication (Firebase supports it, but we won't expose it)

**No complex collaboration:**
- ❌ Real-time editing
- ❌ Comments/annotations
- ❌ Version control with merge conflicts
- ❌ Approval workflows

**Simple rule:** All members of an org can access all sessions in that org. Period.

## Migration Strategy

### Existing Sessions (Backward Compatibility)

**Current state:**
- Redis contains sessions with UUIDs
- Users have bookmarked `?session=<uuid>` URLs
- No org association

**Migration approach:**

**Option A: Sunset old sessions gracefully**
1. Keep old Redis sessions working until 30-day TTL expires
2. Show banner on old sessions: "Login to save your work long-term"
3. After 30 days, all old sessions expire naturally
4. Pro: Clean break, no data migration complexity
5. Con: Users lose access to in-progress work after 30 days

**Option B: Manual migration for active sessions**
1. Your parents/BB staff identify active series (email to facilitators)
2. Facilitators create new accounts + re-upload their Excel files
3. Old sessions sunset on 30-day TTL
4. Pro: Active users don't lose work
5. Con: Manual communication burden

**Recommendation:** Option A (clean break). Current TTL is 30 days, so this is already expected behavior. Add a migration banner to existing sessions warning users.

### Deployment Phases

**Phase 1: Infrastructure (Week 1)**
- Set up Firebase project (Auth + Firestore)
- Add Firebase Admin SDK to FastAPI backend
- Create Firestore schema + security rules
- Deploy auth middleware (no UI changes yet)

**Phase 2: User Auth (Week 2)**
- Build login page (email input + magic link)
- Integrate Firebase Auth SDK in frontend
- Add token passing to all API requests
- Test end-to-end auth flow

**Phase 3: Multi-Tenancy (Week 3)**
- Migrate session storage from Redis → Firestore
- Implement org-based authorization checks
- Build session dashboard UI
- Test access control boundaries

**Phase 4: Admin Panel (Week 4)**
- Build admin panel for org creation (see next section)
- Implement invite email flow
- Test onboarding UX with non-technical users

**Phase 5: Migration (Week 5)**
- Add migration banner to old sessions
- Launch with first real Building Bridges series
- Monitor for issues

## Cost Analysis

### Firebase Free Tier Limits

**Firebase Auth:**
- Users: Unlimited ✅
- Phone auth: 10k verifications/month (not using)
- Email links: Unlimited ✅

**Firestore:**
- Stored data: 1 GB ✅
- Document reads: 50k/day ✅
- Document writes: 20k/day ✅
- Deletes: 20k/day ✅

**Estimated Usage (20 series, 6 facilitators each = 120 users):**
- Firestore writes: ~500/day (uploads + results)
- Firestore reads: ~2000/day (dashboard loads, result views)
- Storage: ~100 MB (participant data + results)

**Verdict:** Well within free tier. Would need 100x growth to hit limits.

### Total Infrastructure Costs

| Service | Current Cost | New Cost | Notes |
|---------|--------------|----------|-------|
| Upstash Redis | Free tier | Free tier | Unchanged |
| Google Cloud Run | ~€10/month | ~€10/month | Unchanged |
| Firebase Auth | N/A | €0 | Within free tier |
| Firestore | N/A | €0 | Within free tier |
| **Total** | **~€120/year** | **~€120/year** | No increase ✅ |

## Security Improvements

### What This Fixes

✅ **Link leakage protection:** Links only work with authentication
✅ **Audit trail:** Firestore logs all reads/writes (visible in console)
✅ **Access revocation:** Remove user from org → all their access gone
✅ **Data retention:** 60+ days now viable (Firestore has no TTL, manual cleanup)
✅ **Org isolation:** Bay Area staff cannot access Austin data, even with URL

### What This Doesn't Fix

⚠️ **Encryption at rest:** Depends on Firebase's encryption (assumed present, not verified)
⚠️ **Screenshot leakage:** If someone screenshots assignments, no technical control
⚠️ **Email forwarding:** If facilitator forwards magic link, recipient gets their access (60-min expiry limits this)

### Compliance Readiness

**GDPR considerations:**
- **Right to access:** Users can see all their org's data via dashboard
- **Right to deletion:** Admin can remove users + delete org data (need to build this)
- **Data minimization:** Already minimal (names + religion only)
- **Privacy policy:** Still need to write one

## Admin Panel Design

**URL:** `group-builder.netlify.app/admin`

**Target users:** Building Bridges staff (parents) - comfortable with Google Workspace, minimal technical expertise

**Design philosophy:**
- Mirror Google Workspace Admin patterns (familiar mental model)
- Two-field form (series name + emails) - fast and foolproof
- No configuration options to decide
- Can iterate and add metadata fields later based on actual usage

### Screen 1: Admin Login

**Accessed via:** `group-builder.netlify.app/admin`

```
┌─────────────────────────────────────────┐
│         GroupBuilder Admin              │
│                                         │
│  Building Bridges staff login           │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │ Email address                     │ │
│  └───────────────────────────────────┘ │
│                                         │
│  [ Send me a login link ]              │
│                                         │
└─────────────────────────────────────────┘
```

**Auth mechanism:**
- Same Firebase magic link as facilitators
- Admin users identified by `bb_admin` role in Firestore
- Bootstrap: Manually add parent emails to `bb_admins` collection during initial setup
- After clicking magic link → redirects to Organizations Dashboard

### Screen 2: Organizations Dashboard

**Default landing page after admin login:**

```
┌──────────────────────────────────────────────────────────────┐
│  GroupBuilder Admin                    [Mom's Name ▼] Logout │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Organizations                      [ + Create Organization ]│
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Austin BB March 2026                     6 members      │ │
│  │ Created Jan 15, 2026                     [Manage]       │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Bay Area BB Winter 2026                  6 members      │ │
│  │ Created Dec 1, 2025                      [Manage]       │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Phoenix BB Spring 2026                   5 members      │ │
│  │ Created Jan 10, 2026                     [Manage]       │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Features:**
- Simple chronological list (newest first)
- Shows member count at a glance
- Single action per org: "Manage"
- Primary CTA: "+ Create Organization"

### Screen 3: Create Organization Form

**Triggered by:** Clicking "+ Create Organization"

**Display:** Modal overlay or dedicated page

```
┌──────────────────────────────────────────────────────────────┐
│  Create Organization                                    [✕]  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Series Name *                                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Austin BB March 2026                                   │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  Facilitator Emails *                                        │
│  One email per line. We'll send them invites.               │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ sarah@austin-synagogue.org                             │ │
│  │ david@austin-synagogue.org                             │ │
│  │ imam@austin-mosque.org                                 │ │
│  │ fatima@austin-mosque.org                               │ │
│  │ pastor@austin-church.org                               │ │
│  │ maria@austin-church.org                                │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│         [Cancel]              [Create & Send Invites]       │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Form behavior:**
- **Series Name:** Required, free text, 100 char limit
- **Facilitator Emails:** Textarea, validates email format, allows copy-paste from spreadsheets
- **Validation:**
  - Email format check (basic regex)
  - Duplicate email warning
  - No minimum facilitators (flexible for edge cases)
- **Backend action on submit:**
  1. Create organization document in Firestore
  2. Create invite records for each email (with 7-day expiry)
  3. Send invite emails via SendGrid
  4. Show success confirmation

**Success confirmation:**

```
┌──────────────────────────────────────────────────────────────┐
│  ✓ Organization Created                                      │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Austin BB March 2026 has been created.                     │
│                                                              │
│  Invitation emails sent to 6 facilitators:                  │
│  ✓ sarah@austin-synagogue.org                               │
│  ✓ david@austin-synagogue.org                               │
│  ✓ imam@austin-mosque.org                                   │
│  ✓ fatima@austin-mosque.org                                 │
│  ✓ pastor@austin-church.org                                 │
│  ✓ maria@austin-church.org                                  │
│                                                              │
│                              [Done]                          │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Error handling:**
- Invalid email format → highlight field, show inline error
- Duplicate emails → warning message, allow proceeding
- SendGrid failure → show which emails failed, offer "Retry" button

### Screen 4: Manage Organization

**Triggered by:** Clicking "Manage" on an organization

```
┌──────────────────────────────────────────────────────────────┐
│  ← Back to Organizations                                     │
├──────────────────────────────────────────────────────────────┤
│  Austin BB March 2026                                        │
│                                                              │
│  Members (6)                              [ + Add Member ]   │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Sarah Cohen                                            │ │
│  │ sarah@austin-synagogue.org                             │ │
│  │ Joined Jan 16, 2026                      [Remove]      │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ David Levy                                             │ │
│  │ david@austin-synagogue.org                             │ │
│  │ Joined Jan 16, 2026                      [Remove]      │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Imam Ahmed                                             │ │
│  │ imam@austin-mosque.org                                 │ │
│  │ Invited Jan 15 (pending)                 [Resend]      │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  Sessions (3)                                                │
│                                                              │
│  • Session 1 - Created Jan 17 by Sarah - 24 participants    │
│  • Session 2 - Created Jan 18 by Imam Ahmed - 24 participants│
│  • Session 3 - Created Jan 20 by David - 24 participants    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Management capabilities:**

**Member management:**
- **View status:** Shows who's joined vs pending invites
- **Remove members:**
  - Confirmation dialog: "Remove Sarah from Austin BB March 2026?"
  - Immediately revokes access (deletes from `members` subcollection)
  - Cannot remove yourself (last admin protection)
- **Resend invites:**
  - For pending invites only
  - Generates new invite token, sends new email
- **Add members:**
  - "+ Add Member" button → simple email input modal
  - Sends invite, updates member list

**Session oversight:**
- **Read-only list:** Shows all sessions created within this org
- **Context for support:** If facilitator reports "I can't find my session," admin can see it exists
- **No edit capability:** Admins don't modify session data, just view metadata

### UX Principles

**1. Familiar patterns (Google Workspace-like):**
- Standard form controls
- Consistent button placement
- Breadcrumb navigation ("← Back to Organizations")
- Profile dropdown for logout

**2. Forgiving and reversible:**
- Can add members after initial creation
- Can resend invites if emails bounce
- Can remove and re-add members
- Confirmation dialogs before destructive actions

**3. Minimal cognitive load:**
- Two-field creation form (can't mess it up)
- One action per screen
- No configuration options to puzzle over
- Clear success/error messages

**4. Copy-paste friendly:**
- Textarea for emails (paste from spreadsheet)
- No forced formatting (one email per line is intuitive)
- Validates after paste, doesn't block input

### Email Templates

**Invite email template (SendGrid):**

```
Subject: You've been invited to {{org_name}} on GroupBuilder

Hi there,

{{inviter_name}} from Building Bridges has invited you to
collaborate on {{org_name}}.

GroupBuilder helps create balanced and diverse table assignments
for interfaith dialogue sessions.

Click here to get started: {{invite_link}}

This invitation expires in 7 days.

Questions? Reply to this email to reach Building Bridges support.

---
GroupBuilder by Building Bridges
```

**Magic link email template (Firebase default):**

```
Subject: Sign in to GroupBuilder

Click here to sign in to GroupBuilder: {{magic_link}}

This link expires in 60 minutes.

If you didn't request this, you can safely ignore this email.

---
GroupBuilder
```

### Admin Bootstrap Process

**One-time setup (performed by developer):**

1. **Create Firebase project:** `groupbuilder-prod`
2. **Enable Firebase Auth:** Email link provider
3. **Create Firestore database:** Start in test mode, deploy security rules later
4. **Add BB staff as admins:**
   ```python
   # One-time script
   firestore.collection('bb_admins').document('parent1@buildingbridges.org').set({
       'email': 'parent1@buildingbridges.org',
       'created_at': datetime.now(),
       'created_by': 'bootstrap'
   })
   ```
5. **Deploy admin frontend:** `/admin` route in Netlify
6. **Test:** Parent logs in, creates test org, invites test user

**Normal operation (no dev involvement):**
- Parents log into `/admin`
- Create orgs, invite users
- Manage members as needed
- No technical knowledge required

### Future Enhancements (Not MVP)

**Possible additions based on usage:**
- Search/filter organizations (if >20 orgs)
- Bulk operations (archive multiple orgs)
- Metadata fields (start date, location, primary contact)
- Monday.com integration ("Export to GroupBuilder" button)
- Analytics dashboard (usage stats, active series)
- Email template customization
- Organization templates (pre-fill common configs)

**Implementation strategy:** Ship minimal version, observe parents using it, add features they actually request.

## Security Considerations

### Admin Access Control

**Who can access `/admin`:**
- Users with email in `bb_admins` collection
- Verified via Firebase Auth + Firestore lookup
- No hardcoded emails in code (data-driven)

**What admins can do:**
- Create organizations ✅
- View all organizations ✅
- Manage organization members ✅
- Remove members (revoke access) ✅
- View session metadata (read-only) ✅

**What admins CANNOT do:**
- Edit session data (assignments, participant info) ❌
- Delete sessions ❌ (deliberate choice - prevents accidental data loss)
- Access Firebase console directly ❌ (developer-only)

### God Mode Considerations

**BB admin capabilities:**
- Can see all orgs (listed on dashboard)
- Can view which facilitators belong to which orgs
- Can see session metadata (created by, date, participant count)
- CANNOT see actual participant data without joining the org as a member

**Privacy by design:**
- Admins have oversight, not unrestricted access
- To view sensitive data (participant names, assignments), admin would need to:
  1. Add themselves as member of that org
  2. Log in as facilitator (not admin)
  3. Access session normally
- This creates audit trail if BB staff accesses customer data

**Future: More granular audit logging:**
- If BB wants true "support mode," could add:
  - "View As" feature (admin impersonates user, logged)
  - Read-only participant data view (no edit capability)
  - Full audit log of admin actions
- MVP assumes BB staff don't need routine access to participant data

## Open Questions (Resolved)

### 1. Should BB staff have separate "super admin" login?

**Decision:** Yes, via `/admin` route and `bb_admin` role.

**Rationale:**
- Keeps admin interface separate from facilitator interface
- Parents don't see facilitator features (upload form, solver options)
- Facilitators don't see admin features (org creation)
- Clean separation of concerns

### 2. Do we need audit logging beyond Firestore's built-in logs?

**Decision:** Not for MVP. Firestore console provides sufficient visibility.

**Future:** If BB needs formal audit reports, add application-level logging.

### 3. Should facilitators be able to delete sessions?

**Decision:** No, not in MVP.

**Rationale:**
- Prevents accidental data loss
- If facilitator wants to delete, they contact BB staff
- Can add "soft delete" (archive) later if requested

### 4. How do we handle email bounces on invites?

**Decision:** Manual handling via SendGrid dashboard.

**Process:**
- SendGrid reports bounces in web UI
- Parent sees bounce → contacts facilitator for correct email
- Parent uses "Resend invite" or "Add member" with corrected email

**Future:** Webhook integration to show bounce status in admin panel.

---

## Next Steps

**Ready for implementation planning:**
1. Set up Firebase project and configure Auth + Firestore
2. Implement backend auth middleware and authorization logic
3. Build facilitator login flow and session dashboard
4. Build admin panel UI
5. Migrate first real Building Bridges series as beta test

**Implementation plan document:** To be created with detailed technical tasks and sequencing.
