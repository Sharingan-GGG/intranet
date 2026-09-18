# Audit Hub (`/audit`)

SEO/GEO page audits for the group's three WordPress sites, migrated from the
standalone portal at `GEO - SEO Web Portal` and its own Supabase project
(`wykyknbeaektpbuhlehk`, now retired).

The tool only ever *queues* work. The audits themselves are produced by two
Claude Code routines that run out of band and write their results straight into
the `audit` schema:

| Worker | Reads | Writes |
| --- | --- | --- |
| `seo-page-agents` | `seo_agent_tracker` where `started_at is null` | `audit_runs`, `audit_issues`, and the tracker's status |
| Site content audit | `content_audits` where `status = 'queued'` | `content_audits.report` + `.summary_report` |

## Screens

| Path | What it is |
| --- | --- |
| `/audit` | Redirect into the Dashboard's default tab |
| `/audit/scheduler/content-pre-check` | Every page on the domain, against the content triage queue. The only tab that can queue a content audit. |
| `/audit/scheduler/full-seo-page-scan` | Pages promoted from Content. Run / Report / Done / Cancel, plus Scan Type and Assigned. |
| `/audit/scheduler/archived` | `content_audits` rows with `archived = true` |
| `/audit/scheduler/completed` | Full-scan rows whose tracker status is Done |
| `/audit/completed` | The standalone Completed table — adds keyphrase, keyword score and the stat cards |
| `/audit/domain-list` | One card per site with live published counts |
| `/audit/traffic` | GA4 engagement for one site: summary cards, then that site's pages by title, over a 7/28/90/365-day window |
| `/audit/traffic/page-detail?path=…` | One page's traffic: totals, daily trend, and splits by channel, device and country — plus its SEO report if it has one |
| `…/page-detail/{trackerId}` | One full-scan run: gauge, dimension bars, findings, history |
| `…/content-audit/{id}` | A content triage row, rendered through the same screen |

`scheduler` is the URL segment the portal shipped and is kept so existing links
resolve; the screen is the **Dashboard** everywhere in the UI.

## The GA4 Views column on the Dashboard

Every row carries its **GA4 views**, and the two controls behind that number
sit where each one's reach is:

- **`audit-toolbar__controls`** carries the **All GA4** channel select, beside
  the site select, listing the channels that site's property actually saw with
  their session counts. It scopes the whole list — choosing one recounts the
  views from that channel alone *and* drops the pages it never reached, which
  is "which of these did organic search actually reach", the question the
  Dashboard could not answer before.
- **The column header** carries the window — **7D · 28D · 90D · 12M**, the same
  four `GA4_RANGES` the Traffic screen offers. The select *is* the heading, as
  in the WP Updated column: no label sits beside it, because the control
  already says what the column holds and a label crowded a cell this narrow.
  Hence the short spellings, from `ga4RangeShort`; `GA4_RANGE_LABELS` keeps
  the long ones for Traffic's seg buttons, where they have the room. It changes
  nothing but this column, and a bare view count is meaningless until the
  header says how far back it counts.

The **Page** column's sort dropdown carries **GA4 Views — Highest / Lowest**
alongside the date and title sorts, because a views column you cannot order by
only answers "how many" one row at a time. Pages GA has never seen stay at the
bottom in *both* directions: they are unknown, not zero, and putting them first
under Lowest would bury the least-read pages the sort was asked for.

With no channel selected the column shows each page's total across all channels
and nothing is filtered out: filtering on All GA4 would hide every page GA has
never seen, which on the Content queue is most of the reason to be looking. A
page with no views, and every row on a site with no property, reads as a dash
rather than a zero — zero would claim we measured it and found nothing.

Both are navigations (`?ga4=` and `?days=`), not local state: the figures come
from the server. `?days=` is deliberately the name Traffic already uses, so the
two screens read the same range out of a URL, and it is put through
`resolveGa4Range` on arrival so `?days=999` falls back to 28 rather than
reaching GA with a window it does not offer. Selecting a site clears the
channel, because channels are per-property; the window survives, because it is
not. The traffic drawer follows the same window, so opening a row cannot
contradict the column that sent you there.

Three things keep it honest:

- **It is an extra, never a gate.** A site with no GA4 property (TWCT) or a GA
  outage leaves the select empty and disabled, and the queue renders exactly as
  before. The whole block is wrapped in a `try`.
- **The path limit is 1000, not the page table's 50.** This also answers "did
  this page get *any* traffic from that channel", so a page ranked 400th by
  views still has to be in the set or the filter would quietly hide pages that
  do qualify. RAT AU's organic set is 340 distinct paths.
- **Paths are normalised** through `normaliseAuditPath` — WordPress gives
  `/deals/`, GA4 reports `/deals`. Without it the filter would match nothing and
  look like "no pages have organic traffic".

The views cross the server boundary as `{ path, views }` pairs and are rebuilt
as a `Map` in the component; a `Map` is not serialisable. The filter's `Set` is
that map's keys, so one request serves both the numbers and the filter. Views
are summed per path — the GA report groups by title *and* path, so a page whose
title changed mid-window comes back as two rows.

Both lookups are **cached for an hour** (`unstable_cache`, tag
`GA4_DASHBOARD_TAG`), keyed by property, channel and window so the four ranges
never share an entry. The window ends *yesterday*, so the answer only changes
once a day, and the Dashboard is opened repeatedly — an hour is short enough to
pick up the new day and long enough that reopening costs nothing. `refreshGa4`
busts the tag so an explicit refresh is not left an hour behind. The Traffic
screen deliberately calls the **uncached** versions: there the numbers are the
content and are promised live; here they fill a dropdown, one column and two
cards. Three GA requests per property/channel/window combination, against a
quota of 1,440 per property per day.

### The two GA4 cards on the summary strip

Every tab's `audit-summary` ends with **Traffic Type** and **Bounce Rate**,
`Ga4Stat` cards lifted from the Traffic screen — including its delta arrow,
where the colour answers "is that good" rather than "which way did it move", so
a bounce rate falling is a green ▼. `Ga4Stat` now lives in `ga4-stat.tsx` and
both screens import it; two copies would have been two cards that look alike
until someone changes one.

- **Traffic Type** names its channel in the label — *Traffic Type - Organic
  Search* — carries that channel's share of all sessions as the figure, and the
  movement underneath. The channel is whichever the toolbar filter has, or
  Organic Search on All GA4, that being the one this hub exists to move. It is
  derived from the channel list the filter already needed, including a
  `prevShare` added for the delta, so the card costs no extra request.
- **Bounce Rate** is `loadGa4BounceCached`, one figure narrowed out of
  `loadGa4Summary`'s six. Channel- and window-aware like everything else on the
  strip, or the card and the column beneath it could disagree about which slice
  of traffic they describe.

These two are the **one exception** to the invariant below: they are the
property's figures and no filter on this screen narrows them, which is also why
they render on all four tabs. Both read `—` with no GA4 property behind them,
and the whole block is inside the same `try` as the rest — a GA outage costs
the cards, never the queue.

**Publish As Is is not on the decision strip**, on either tab that shows one.
It was the one figure up there that no action follows from, and dropping it
leaves Content Pre-Check and Archived the same six cards — Scanned, three
decision boxes and the two GA4 ones — rather than two strips differing by a
single box. The decision itself is untouched: the filter still offers it and
the rows still carry its chip.

**Clicking anywhere on a row opens the traffic drawer**, the same panel the
Traffic screen uses. Dashboard rows are dense with controls — a checkbox, a
star, the assign menu, eleven buttons, three links and a select — so the
handler steps aside for anything interactive (`closest('a, button, input,
select, textarea, label, …')`) rather than trying to list what it should
respond to. It also ignores a click that ended a text selection, which on rows
this wide is easy to do by accident. The title stays a button because a click
handler on a `<tr>` is not reachable by keyboard.

Unlike the Traffic screen's, this drawer is **component state fed by a server
action** (`getPageTraffic`), not an intercepting route. Intercepting across this
segment would re-run WordPress, four queries and the GA4 lookups just to open a
panel over them. The trade is that the browser's Back does not close this one —
which is also why `AuditTrafficDrawer` takes an optional `onClose` instead of
always calling `router.back()`.

A page with no GA4 rows says so outright. "No property connected", "the request
failed" and "GA has nothing for this path" are three different answers and get
three different messages — an empty panel would make them look identical.

## Two invariants that are easy to break

- **The summary boxes count visible rows**, so every active filter applies to
  them. A box that counted `rows` rather than `visible` would disagree with the
  table under it. The two GA4 cards are the stated exception above: they are
  GA's answer for the whole property, and they say which channel and window
  they mean on their own caption.
- **Bulk actions only touch rows that are both ticked and visible.** Narrowing
  the list must never queue something the user cannot see.

A third, in the finding counts: **only a page's newest run counts.** Page Detail
renders that run's findings and nothing else, so summing every run made the box
impossible to reconcile — a page scanned five times showed 151 open against 12
on screen.

## Shape

```
src/app/audit/**                     routes, layout, server actions
src/components/work/audit/**         client components
src/lib/audit-*.ts                   data layer, roster, route model, adapters
src/lib/audit-db.ts                  pg pool + auditQuery(), the direct connection
src/lib/google-analytics.ts          GA4 Admin + Data APIs, hand-rolled REST
src/lib/audit-ga4.ts                 the GA4 nightly ingest and the traffic reads
src/app/api/audit/ga4-ingest/        the cron endpoint (the hub's only API route)
supabase/database/schemas/audit/**   the schema itself (see its own README)
scripts/audit-copy.mjs               one-time data copy from the old project
```

Data access is **plain SQL over a direct Postgres connection**, not supabase-js.
PostgREST will not serve a schema that is not in its exposed list, and on this
project the saved config and the running service disagree — `audit` is
configured but PGRST106 persisted through a reload and a full restart. A direct
connection sidesteps that, and costs nothing: every caller is server-side and
`payload_app` owns every table in the schema, so it bypasses RLS. One small
shared pool, because the session pooler is `pool_size 15` shared with Payload.

Reads happen in server components and throw on failure, so a broken query hits
an error boundary instead of rendering as an empty table. Writes are server
actions that return a result for the UI to toast, and each re-checks
`route:audit` — a server action is reachable by anyone who can guess its id, so
the check on the page only decides what renders.

## GA4 traffic

The traffic screen never calls Google. A nightly cron POSTs
`/api/audit/ga4-ingest` with a `CRON_SECRET` bearer token; that writes one row
per property per day into `audit.ga4_daily`, and the screen reads Postgres. This
is the hub's only API route — every other write is a server action, and those
POST to a page URL, so they already carry a session. Cron does not.

Three things here are load-bearing and look optional:

- **The service account is a Viewer at the GA _account_ level**, not per
  property. Granted per property, the Admin API enumerates nothing: discovery
  returns an empty list and the screen is simply blank, with no error.
- **The job re-pulls a trailing 3 days, not just yesterday.** GA4 figures are
  not final for roughly 48h, so a yesterday-only pull would store provisional
  numbers permanently. `(property_id, date)` is the upsert's conflict target,
  which is what makes the re-pull overwrite instead of duplicate.
- **Rates and averages are re-derived over a window, never summed.**
  `engagement_rate` is `sum(engaged)::numeric / sum(sessions)` — the cast
  matters, because bigint division silently returns 0 — and the average session
  duration is weighted by sessions. Averaging the daily columns weights a quiet
  Sunday like a busy Monday.

Dates come from GA's relative tokens (`3daysAgo`, `yesterday`) so Google
resolves them in each property's own timezone; computing them from the server
clock would put AU and NZ properties on a Sydney day.

The screen is **shaped like the Dashboard on purpose**: `?domain=` picks the
site (default RAT AU), the same summary strip sits on top, and the same
two-row `audit-toolbar` holds the range, the filter and the site select. It is
the same job on a different data source, and a second table design for it would
be a second thing to keep in step. It does not copy the row machinery — there is
nothing to tick, star, assign or queue here.

**Everything on the screen is live; `audit.ga4_daily` backs none of it.** The
six summary figures need key events and three GA-computed ratios the snapshot
does not hold, and splitting anything by channel needs a dimension it does not
have. Three calls run in parallel per load: the channel split, the summary
figures, and the page table. The snapshot is now purely the historical store the
nightly ingest keeps warm — worth knowing before anyone assumes the cron is
load-bearing for this page. (It is still the only place GA4 history accumulates,
and GA4 itself only keeps 14 months.)

The six cards are chosen for what this hub is for, not for generic analytics:

| Card | Why | Filtered by channel? |
| --- | --- | --- |
| Organic Share | the one figure that says whether SEO is working | no — composition |
| AI Assistant | the GEO signal; real ChatGPT/Gemini/Perplexity referrals | no — composition |
| Key Events | traffic that did something (`thank_you`, `form_submit`) | yes |
| Bounce Rate | asked of GA, not derived from engagement rate | yes |
| Views / Session | depth | yes |
| Sessions / User | return visits | yes |

Organic Share and AI Assistant deliberately ignore `?channel=`: they describe how
the *site's* traffic is composed, which is a property fact, not a fact about the
slice on screen. Their cards say "of all traffic" so the scope is on the card
rather than in this file.

The delta's arrow and its colour answer different questions — a falling bounce
rate is a green ▼ — so `Delta` takes `lowerIsBetter` rather than colouring by
direction.

The ratios are **asked of GA, not derived**. Bounce rate is nearly `1 -
engagementRate` and views-per-session is nearly `views / sessions`, but GA
computes both against its own session and user counts and the derived versions
land a few percent off what the GA4 UI shows for the same range.

**The page table is fetched live** too. Per-page rows are high-cardinality —
~450 titles for RAT AU alone — so storing them nightly would cost far more than
it saves for a table that only renders for the one site you are looking at.

**Traffic is unfiltered by default, and that default flatters SEO.** On both
live properties paid is the *majority* of all traffic (RAT AU: Paid Social 39%
+ Paid Search 18%, against 30% Organic Search; RAT NZ: Paid Social 56% + Paid
Search 6%, against 16% Organic Search). Read next to an SEO score, an
all-traffic figure credits SEO for work it had no part in — RAT AU's `/deals/`
is 17,841 views unfiltered and 4,045 from organic search.

So `?channel=` filters the whole screen to one GA4 default channel group. Two
consequences worth knowing:

- **The channel list is derived, not hardcoded.** One request per load returns
  the channels that property actually saw, so the filter never offers one that
  would return an empty table. GA4's full default-channel set is much longer
  than any property uses.
- **The filter changes where the cards come from.** Unfiltered they read the
  nightly snapshot; filtered, the snapshot has no channel dimension, so they
  come from GA in the same request that built the channel list. That request
  asks for two *named* date ranges, which is what keeps the previous-period
  deltas without a second round trip — GA appends a `dateRange` dimension and
  returns a row per (channel, range), which `runGa4ChannelReport` merges. The
  header line says which of the two you are looking at.

**The channel chips are the only channel control** — there is no select, and no
page header above them; the topbar already says which screen this is, so the
`<h1>` is `sr-only` for the document outline. The strip leads with an **All**
chip carrying the unfiltered total, which is both the default state and what
makes the channels beside it legible as parts of a whole. A `?channel=` that is
not in the list (a stale link, or a channel with no traffic in the chosen
window) gets a synthetic zero chip, so the screen always offers a way back.

**The All chip is ~1.8% under GA's true session total** — 25,786 against 26,249
on RAT AU's last 28 days. Not a bug and not fixable: every dimensioned request
loses the sessions GA cannot attribute, and the chips are dimensioned by channel
while the cards are not. It is why the summary report asks for plain totals and
leaves the splitting to the chips.

The freshness note is **the Refresh button's tooltip** (the button sits at the
end of the toolbar's tab row, after the search), not a line of prose under the
title. It still says which source you are reading — nightly snapshot when
unfiltered, live from GA when not — and that GA4 is not final for ~48h, but it
is hover-only, so a stale cron is less visible than it was.

**Clicking anywhere on a row opens the drawer.** The row handler steps aside
for clicks that landed on a link (`closest('a')`), so the arrow still goes to
the live page and the title — kept as a real link for keyboard and middle-click
— still opens the drawer. Two destinations on one row, and the browser already
knows what to do with the one it was given. The page travels as
`?path=` rather than a route segment — a URL path inside a path needs encoding
either way, and a query parameter carries the site, range and channel in force
with it. The path *below* the title still links to the live page: two links,
two destinations, which is why the title is not also an external link.

The drawer is an **intercepting route**, the only one in this codebase:

```
traffic/
  layout.tsx                    children + the drawer slot
  page.tsx                      the list
  page-detail/page.tsx          the full page — hard load, refresh, outside link
  page-detail/load.ts           the shared loader both forms call
  @drawer/default.tsx           null, when no drawer route matches
  @drawer/(.)page-detail/       the same detail, intercepted into the drawer
```

That machinery buys one thing worth having: `children` keeps rendering the list
it already had, so opening a page costs its own five GA calls and nothing more.
Rendering the drawer from the list's own `?page=` instead would re-run the list
— three more GA calls on every open and every close.

Two consequences to keep in mind when editing it. Closing is `router.back()`,
not a state flip, because the drawer *is* a history entry — it was opened by a
navigation, so the browser's Back must close it too. And the slot must never
`redirect()`: that would move the page out from under the drawer, so a missing
`?path=` renders null there while the full page redirects.

That screen is five parallel GA requests (totals, daily, and three splits) —
one grouping per report is all GA returns. Its channel split deliberately
ignores `?channel=`: filtered, it would be one bar at 100% and say nothing.

When a page has traffic but **no** SEO report, the drawer offers a **Check
content** button into the Dashboard's Content Pre-Check tab, built by
`contentPreCheckForPath` in `audit-route.ts` so the parameter and the fragment
cannot drift apart:

```
/audit/scheduler/content-pre-check?domain=…&highlight=%2Fdeals%2F#highlighted-row
```

Three things land that row in front of you, and all three are needed. The query
**marks** it green and **seeds the filter** — marking alone usually marks
something off-screen, since the list pages client-side at 30 rows. The fragment
names it. And the Dashboard scrolls to it in an effect, because the browser
resolves a fragment before React has rendered the table, so by the time the row
exists the jump has already missed; the table is its own scroll container, so
that scroll happens within it rather than moving the page.

Path matching ignores trailing slashes throughout — WordPress stores `/deals/`,
GA4 reports `/deals`, and the tracker holds both — so an exact comparison would
silently never fire.

It also makes **the join this hub existed for**: the same URL matched against
`audit.seo_agent_tracker`, so a page's SEO score sits beside its traffic. The
tracker stores absolute URLs with a trailing slash and GA reports paths without
one, so the lookup tries four spellings (bare and trailing-slash, with and
without `www`) against `"Domain"`. What it surfaces is the point — RAT AU's
`/deals/` is the single most-viewed page on the site at ~17,800 views and has
**never been scanned**, while `/about/` is audited and Done.

Switching site drops the channel filter: channels are per-property, so one
site's selection would otherwise show an empty table under a channel name that
site never saw.

The page cell shows the **title and an `↗` arrow**, not the spelled-out path —
on every Dashboard tab as well as here. The path repeated the title on most
rows and cost each row a second line; the arrow keeps the link out to the live
page and carries the URL in its `title`, so removing the text did not remove
the ability to see where it goes. On the Dashboard the arrow nests inside the
title so the two share a line; on Traffic they are siblings in `.ga4-pagecell`,
because the title is itself a `<Link>` and an `<a>` inside one is invalid.

Rows are grouped by **title and path**, not title alone. Title alone reads
better but silently merges pages that share one, and leaves nothing to link to;
the path is `pagePath`, not `pagePathPlusQueryString`, so campaign parameters do
not shatter one page into a dozen rows.

The metric columns are toggled by the chips in the toolbar, driven by one
`METRICS` list in `traffic.tsx` so a metric cannot appear in the chips but be
missing from the table. The choice is kept in `localStorage`, read after mount
rather than during render — seeding state from `localStorage` is the same
hydration bug the topbar's theme toggle documents.

`audit-table--traffic` is the one table here with `table-layout: auto`. The
column count changes as metrics are toggled, and under `fixed` a cell's
min-width is ignored, so the title column would collapse once enough metrics
were on.

**Not every site has a GA4 property** — TWCT does not. Those sites stay
selectable and say so, rather than rendering an empty table that looks broken.

## Access

Three layers, the same as Pre-Departure:

1. `AUDIT_ENABLED` in `src/middleware.ts` — inlined at build time; unset on a
   production build and `/audit` 404s rather than redirecting to login.
2. The global session gate.
3. `route:audit` via `hasPageAccess`, granted per department in the Payload
   admin. Default-deny.

The nav link is CMS-managed (a Quick Link or Header item pointing at `/audit`),
not in code.

## Roster

Assignment is stored on `seo_agent_tracker.assigned` as **emails**. The portal
stored bare first names against two hardcoded arrays; those nine names turned
out to be exactly the Marketing and IT departments, so the roster is a Payload
query now (`lib/audit-roster.ts`) and adding someone to the department is all
that is needed. Email is the join key used everywhere else between Supabase Auth
and Payload users, and unlike a display name it survives a rename.

Which team a page's assignees are on decides which findings count as theirs —
`MARKETING_DIMS` and its exact complement. Assigned across both teams, or
unassigned, counts everything.

## Things deliberately not carried over

- The hand-rolled `history.pushState` router — App Router expresses the same
  URLs natively.
- `src/schedule.ts`, a localStorage run schedule nothing ever polled.
- `src/dom.ts` (`el`, `escapeHtml`) — JSX replaces it.
- The anon Supabase key in the browser, and with it the wide-open RLS the portal
  needed. Nothing client-side touches the database now.
- `app_secrets` — its seven webhook URLs and tokens are env vars
  (`AUDIT_*_FIRE_URL` / `AUDIT_*_FIRE_TOKEN`).
- The `fire-site-content-audit` edge function, replaced by the outbound POST in
  `actions.ts`.
