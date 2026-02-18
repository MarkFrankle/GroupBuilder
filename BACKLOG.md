# Backlog

Ideas, feature requests, and wishlist items. Not prioritized, not committed to.

## Feature Requests

- **Google Drive file picker** — Allow direct file selection from Google Drive instead of download-then-upload. Uses Google Picker API (client-side only, no Drive access). Low priority — current upload flow works fine. (Requested by user, 2026-02)
- **TanStack Query for client-side caching** — Replace manual useEffect/useState fetch pattern with TanStack Query for stale-while-revalidate caching. Pages show cached data instantly on revisit, background refetch keeps data fresh. Mechanical refactor across ~5-6 page components. Biggest quick win for perceived performance. (2026-02) **DONE**

## Chores

- **Custom SMTP for Firebase Auth emails** — Firebase's sign-in link email template is non-editable (body is hardcoded, shows project ID "group-builder-backend" as app name). Custom domain (`noreply@group-builder.com`) and SPF/DKIM are already configured. To customize the email content: configure SMTP settings in Firebase Console → Authentication → Templates → SMTP settings to send through SendGrid (`smtp.sendgrid.net`, port 587, username `apikey`, password = `SENDGRID_API_KEY`). Then replace Firebase's `sendSignInLinkToEmail()` in `frontend/src/services/firebase.ts` with a backend endpoint that generates the sign-in link via Admin SDK (`generate_sign_in_with_email_link` — already used in `api/src/api/services/email_service.py` for invites) and sends a custom-branded email through SendGrid. Purely aesthetic — sign-in emails currently work and land in inbox. (2026-02)
