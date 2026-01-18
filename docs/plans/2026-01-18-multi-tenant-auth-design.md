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

## Next Steps

### Admin Panel Design (TBD)

**Key requirements:**
- Parents (non-technical) can create orgs easily
- Parents can invite facilitators via email
- Minimal clicks, minimal complexity

**To discuss:**
- Admin panel UX/workflow
- Error handling for failed invites
- BB staff user management

### Open Questions

1. Should BB staff have a separate "super admin" login, or are they just members of all orgs?
2. Do we need audit logging beyond Firestore's built-in access logs?
3. Should facilitators be able to delete sessions, or only BB staff?
4. How do we handle email bounces on invites?

---

**Next conversation:** Admin panel design for non-technical users
