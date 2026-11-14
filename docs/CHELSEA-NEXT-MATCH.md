# Chelsea crest + next Premier League match

## Implemented locally
- Genuine R3F crest disc rotates in the center of Blue Energy. Pause, reduced motion, offscreen and background tab controls apply to the crest as well as the surrounding effect.
- Crest texture: Chelsea FC image source recorded in docs/chelsea-image-sources.json, retrieved as 1000px PNG for clarity. It is a club-owned asset used at the user's request; no reuse license has been verified. Existing independent fan-site notice is retained.
- Homepage loads a dated next-match snapshot immediately, then refreshes it in the background through /api/chelsea-next. No visitor search or football API key is needed for this schedule feature.
- Bot accepts “นัดหน้าเจอใคร”, “เชลซีเตะวันไหน”, “Chelsea next match” and the “เชลซีนัดหน้า” quick reply. Other teams, date-specific searches, results, lineups and predictions retain their existing API-Football workflow.

## Source and freshness
Source page: https://www.chelseafc.com/en/matches/mens-fixtures-and-results
Public JSON feed used by that page: https://www.chelseafc.com/en/api/fixtures/upcoming?pageId=30EGwHPO9uwBCc75RQY6kg
Only men's Chelsea Premier League scheduled fixture facts are retained. Club images, ticket offers, news and other feed material are not copied into the schedule snapshot. Dates are converted from London local time with GMT/BST handling. TBD times are labeled unconfirmed. Past/postponed/cancelled/live matches are excluded from next-match selection.

Server fetch is fixed to the verified official URL; redirects are refused, with a timeout and 1 MB limit. In-memory cache lasts 6 hours, CDN cache 1 hour, with request deduplication and a 5-minute upstream-failure backoff. Dated snapshot is a fallback. No promise of real-time updates is made: the source is a public site feed and can change. Snapshots over 7 days old are marked for verification, and old fixtures are never shown as future matches.

## Weekly refresh (prepared, NOT activated remotely)
Upload .github/workflows/chelsea-schedule.yml together with lib/chelsea-schedule.mjs and scripts/update-chelsea-schedule.mjs to the repository default branch. It runs Monday at 09:00 Bangkok time, or manually via Actions → Update Chelsea schedule weekly → Run workflow. It commits only dist/data/chelsea-next.json with the repository's built-in Actions token; no new secret is required. Repository policies must allow that workflow to push. Failed/empty feed updates fail visibly and retain the old snapshot.

No GitHub push or deployment was performed. Weekly execution and propagation to a published Vercel/GitHub Pages deployment have NOT been verified. GitHub Pages does not automatically run a separate push workflow on a GITHUB_TOKEN commit; trigger its deploy workflow separately if using Pages. On Vercel, the server route can fetch fresh data independently when visited; verify deployment configuration when publishing.

## Verification
54 automated tests pass including winter/summer timezone conversion, malformed data, filtering, past/stale schedules, intent routing, deduplicated upstream requests, fallback and missing data. Browser verified: actual local API returns official data; homepage displays the next fixture automatically; free-text next-match question returns the same fixture; crest and pause button render. Low-power device GPU performance and remote weekly scheduling are not yet tested.
