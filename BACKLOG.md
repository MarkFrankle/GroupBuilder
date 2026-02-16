# Backlog

Ideas, feature requests, and wishlist items. Not prioritized, not committed to.

## Feature Requests

- **Google Drive file picker** — Allow direct file selection from Google Drive instead of download-then-upload. Uses Google Picker API (client-side only, no Drive access). Low priority — current upload flow works fine. (Requested by user, 2026-02)
- **TanStack Query for client-side caching** — Replace manual useEffect/useState fetch pattern with TanStack Query for stale-while-revalidate caching. Pages show cached data instantly on revisit, background refetch keeps data fresh. Mechanical refactor across ~5-6 page components. Biggest quick win for perceived performance. (2026-02)
