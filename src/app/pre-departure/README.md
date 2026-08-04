# Pre Departure — Google Sheets ↔ Supabase sync contract

The Pre Departure queue exists twice: as brand tabs in a Google Sheet, and as rows in
Supabase `pnr_queue`. They are two copies of one list, so **every mutation has to
update both** — move, delete, done, approve, revoke, import.

This document is the contract. Read it before touching anything under
`src/app/api/pnr-queue/`, `src/app/api/sheet-import/`, `src/lib/sheet-sync.ts`, or the
scan path in `src/app/api/sabre/pnr-fetch/route.ts`.

## Column mapping

Each brand tab is columns A–H, in this order. `src/lib/google-sheets.ts` reads them
into `SheetRow`; `toSheetRowValues` in `src/lib/sheet-sync.ts` writes them back.

| Sheet column | Source |
| --- | --- |
| A Client Profile Name | `pnr_queue.client_name` |
| B Departure Date | `pnr_queue.departure_date` |
| C Consultant Name | `pnr_queue.consultant_name` |
| D PNR | `pnr_queue.pnr` |
| E Marked | `pnr_history.status`, falling back to `SYNCED` |
| F Type | `pnr_queue.pnr_type` |
| G Status | derived from `queue_status` — see below |
| H Scanned | `pnr_queue.added_by` → `profiles.full_name` |

The `Done` tab is **not** a brand tab. It is an archive with a different layout
(brand, client, departure, consultant, PNR, date, deleted-by), so its column G holds a
person's name, not a status. Never sweep it with brand-tab logic.

## The rules

### 1. Column G is two-valued, and Supabase owns it

`queueStatusToSheetStatus` maps `queue_status` to exactly two strings:

| `queue_status` | Column G |
| --- | --- |
| `done` | `Completed` |
| everything else (`pending`, `exception`, `processing`, `failed`, `no-flight`) | `Processing` |

The queue's finer states are an intranet concern and are deliberately flattened rather
than leaked into the tab.

Status flows **one way only**: Supabase → sheet. Nothing may read column G back into
`queue_status`. Sheet metadata (A–C and F) *does* flow sheet → queue — the sheet is the
source of truth for those four — but status never does. `reconcileBrandSheet` enforces
this: a column G that disagrees with the queue is overwritten and reported as
`status_pushed`.

Column E is read on import, but only as a "has this row been processed yet" flag. It
must never be left blank for a queued PNR — a blank column E reads as unprocessed and
the import would re-add a PNR that is already in the queue. Hence the `SYNCED` fallback
(`DEFAULT_MARKED`).

### 2. `brand` and `brand_id` are independent columns

Both are `NOT NULL` on `pnr_queue`. The database trigger `trg_pnr_queue_brand_text`
fires `BEFORE INSERT OR UPDATE OF brand_id` and backfills the `brand` text from the id —
but **not the other way round**. Writing `brand` alone silently leaves `brand_id`
pointing at the old brand, and every `brand_id`-keyed read (the dashboard,
`pnr_history`) keeps showing the PNR under the brand it just left.

Always resolve the id with `ensureBrandId` and write both, then mirror it onto
`pnr_history.brand_id`.

### 3. A scan's brand is the tab you are looking at, not the PNR's brand

`fetchFromSabre` (`src/hooks/use-pnr-detail.ts`) sends the brand of the dashboard view,
not the brand the PNR belongs to — a PNR moved to QF is still scannable from the FB
dashboard.

Nothing in the scan path may write `brand_id`, `sheet_row` or `added_by` onto an
existing `pnr_queue` row. A scan owns `queue_status`, `processed_at`, and the metadata
it derived; those three columns are set once, on insert, for a PNR the queue has never
seen. `persistSabrePnrScan` resolves the effective brand from the queue row and only
falls back to the scan's own brand for an unqueued PNR.

This is not theoretical. When the scan re-asserted `brand_id`, the sequence was:

1. Move a PNR FB → QF. It lands; `pnr_audit_log` records `QF`.
2. Open it from the FB dashboard. The scan writes `brand_id` = FB.
3. The trigger rewrites `brand` = FB. The move is undone, seconds later.
4. A later sheet import sees the PNR queued under FB but missing from the FB tab, and
   `reconcileBrandSheet` appends it back — while the QF copy the move created is still
   there. The row now exists in **two** brand tabs.

The same whole-row upsert clobbered `sheet_row` and `added_by` from a snapshot read
moments earlier, undoing whatever `refreshSheetRows` had just re-anchored.

### 4. Never trust a stored `sheet_row` for a write

`pnr_queue.sheet_row` is captured at import time. Deleting a row shifts every row below
it up, so a stored index goes stale the moment anyone deletes anything — and writing to
it hits an unrelated PNR.

Always re-resolve against the live tab with `resolveSheetRowIndices`, which matches on
the PNR in column D, and call `refreshSheetRows` afterwards to re-anchor the stored
values. Queue rows with no matching sheet row are set back to `null` so no later write
aims at a shifted index.

## How reconcile closes drift

`reconcileBrandSheet` runs after every import and fixes four kinds of drift. Neither
side is ever deleted — a row present on only one side is copied to the other. The
exception is tombstoned PNRs (`pnr_deletions`), which were deleted on purpose, so a
leftover sheet row is not imported back in.

1. **Stale row indices** — re-anchored against the tab's current layout.
2. **Rows only in the sheet** — inserted into `pnr_queue`.
3. **Rows only in the queue** — appended back to the tab in column order.
4. **A stale column G** — overwritten from `queue_status`.

## Where things live

| Path | Role |
| --- | --- |
| `src/lib/sheet-sync.ts` | reconcile, status mapping, row-index resolution |
| `src/lib/google-sheets.ts` | raw Sheets API — read, batch update, append, delete |
| `src/app/api/sheet-import/route.ts` | import a brand tab, then reconcile |
| `src/app/api/pnr-queue/*/route.ts` | move, done, approve, revoke, draft, deletes |
| `src/lib/supabase/pnr-queue-metadata.ts` | `pnr_history` mirror, post-scan workflow write |
| `src/app/api/sabre/pnr-fetch/route.ts` | Sabre scan and persistence |
| `src/components/work/pnr-work-dashboard.tsx` | the queue UI |

## Checklist for a change

- Does the write update both sides, or is it deliberately one-way per rule 1?
- Does `brand_id` travel with `brand`, and reach `pnr_history`?
- Does it re-resolve `sheet_row` instead of trusting the stored value?
- If it is on the scan path, does it avoid touching `brand_id` / `sheet_row` /
  `added_by` on an existing row?
