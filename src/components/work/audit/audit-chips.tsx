/**
 * The small coloured chips the Audit Hub paints scores, statuses, severities
 * and editorial decisions with.
 *
 * Every colour here resolves to a `--score-*` / `--sev-*` custom property from
 * audit.css rather than a Tailwind palette class, because the same bands are
 * also read from TypeScript (`SCORE_COLOR` in lib/audit-types.ts). Two sources
 * of truth would let the Dashboard's boxes and the Page Detail gauge disagree
 * about what "good" looks like.
 */
import { band, type ScoreBand, type TaskStatus } from '@/lib/audit-types'

export function ScorePill({ score }: { score: number | null }) {
  const b: ScoreBand = band(score)
  return (
    <span
      className="badge tnum"
      style={{
        background: `var(--score-${b}-soft)`,
        color: `var(--score-${b})`,
        borderColor: 'transparent',
      }}
    >
      {score ?? '—'}
    </span>
  )
}

/**
 * The Full SEO Page Scan tab's Scan Type column: which scan the row is queued
 * for — `Full Scan` alone, or the same scan with the SemRush agent included.
 *
 * SemRush is the one agent that costs API credits per run, so it reads hot
 * against the plain scan's green: the row should say at a glance that this
 * page is spending quota, not just that a scan happened.
 */
export function ScanTypeChip({ fullScan, semrush }: { fullScan: boolean; semrush: boolean }) {
  if (!fullScan) return <span className="tnum muted">—</span>
  const style = semrush
    ? { background: 'var(--sev-critical-soft)', color: 'var(--sev-critical)' }
    : { background: 'var(--score-good-soft)', color: 'var(--score-good)' }
  return (
    <span className="badge" style={{ borderColor: 'transparent', ...style }}>
      {semrush ? 'Semrush' : 'Full Scan'}
    </span>
  )
}

/** Tracker status ladder — seo_agent_tracker.status. */
const TASK_STATUS_STYLE: Record<TaskStatus, { bg: string; fg: string }> = {
  'not-started': { bg: 'var(--score-none-soft)', fg: 'var(--ink-2)' },
  scheduled: { bg: 'var(--sev-info-soft)', fg: 'var(--sev-info)' },
  'in-progress': { bg: 'var(--sev-medium-soft)', fg: 'var(--sev-medium)' },
  'in-review': { bg: 'var(--accent-soft)', fg: 'var(--accent-ink)' },
  done: { bg: 'var(--score-good-soft)', fg: 'var(--score-good)' },
  error: { bg: 'var(--sev-critical-soft)', fg: 'var(--sev-critical)' },
}

export function TaskStatusChip({ status, label }: { status: TaskStatus; label: string }) {
  const style = TASK_STATUS_STYLE[status]
  return (
    <span className="status-chip" style={{ background: style.bg, color: style.fg }}>
      {label}
    </span>
  )
}

/**
 * Content Pre-Check's own status ladder, mirroring content_audits.status.
 * `none` is the synthetic state for a page with no audit row yet.
 */
export const AUDIT_STATUSES = ['none', 'queued', 'running', 'done', 'error'] as const
export type AuditStatus = (typeof AUDIT_STATUSES)[number]

export const AUDIT_STATUS_LABELS: Record<AuditStatus, string> = {
  none: 'Not Started',
  queued: 'Queued',
  running: 'Auditing',
  done: 'Done',
  error: 'Failed',
}

const AUDIT_STATUS_STYLE: Record<AuditStatus, { bg: string; fg: string }> = {
  none: { bg: 'var(--score-none-soft)', fg: 'var(--ink-2)' },
  queued: { bg: 'var(--sev-info-soft)', fg: 'var(--sev-info)' },
  running: { bg: 'var(--sev-medium-soft)', fg: 'var(--sev-medium)' },
  done: { bg: 'var(--score-good-soft)', fg: 'var(--score-good)' },
  error: { bg: 'var(--sev-critical-soft)', fg: 'var(--sev-critical)' },
}

export function AuditStatusChip({ status }: { status: AuditStatus }) {
  const style = AUDIT_STATUS_STYLE[status]
  return (
    <span className="status-chip" style={{ background: style.bg, color: style.fg }}>
      {AUDIT_STATUS_LABELS[status]}
    </span>
  )
}

/** The seo-summary agent's editorial decision (content_audits.summary_report.decision). */
export const DECISION_LABELS: Record<string, string> = {
  publish_as_is: 'Publish As Is',
  needs_revision: 'Revision',
  needs_major_rewrite: 'Rewrite - Expired',
  expired_needs_refresh: 'Rewrite - Expired',
  unpublish_or_noindex: 'Unpublish / Noindex',
}

/**
 * `needs_major_rewrite` and `expired_needs_refresh` render as the same
 * "Rewrite - Expired" chip, so they share a description. Anything listing
 * decisions has to dedupe on the label or it shows that chip twice.
 */
export const DECISION_DESCRIPTIONS: Record<string, string> = {
  publish_as_is: 'Content is fine as it stands — no changes needed.',
  needs_revision: 'Needs minor edits to stay effective. (Content is Current)',
  needs_major_rewrite: 'Content is outdated/expired and needs a substantial rewrite.',
  expired_needs_refresh: 'Content is outdated/expired and needs a substantial rewrite.',
  unpublish_or_noindex:
    'Recommended to remove the page or mark it noindex. (Content is Expired/Not Applicable Anymore)',
}

/** Worse outcomes read hotter, on the same palette as the severity chips. */
const DECISION_STYLE: Record<string, React.CSSProperties> = {
  publish_as_is: { background: 'var(--score-good-soft)', color: 'var(--score-good)' },
  needs_revision: { background: 'var(--sev-low-soft)', color: 'var(--sev-low)' },
  needs_major_rewrite: { background: '#fef3c7', color: '#000', borderColor: '#d97706' },
  expired_needs_refresh: { background: '#fef3c7', color: '#000', borderColor: '#d97706' },
  unpublish_or_noindex: {
    background: 'var(--sev-critical-soft)',
    color: 'var(--sev-critical)',
  },
}

/** The muted placeholder both content columns use before a page has been audited. */
const NO_SUMMARY_STYLE: React.CSSProperties = {
  background: 'var(--sev-low-soft)',
  color: 'var(--sev-low)',
  opacity: 0.6,
}

/**
 * Content/Archive's Status column — `summary_report.expiry.is_expired`.
 *
 * Three states, not two: muted until a summary_report exists at all, then
 * Expired or Current. Collapsing "not audited yet" into "Current" would read
 * as a clean bill of health for a page nothing has looked at.
 */
export function ExpiryChip({ hasSummary, isExpired }: { hasSummary: boolean; isExpired: unknown }) {
  if (!hasSummary) {
    return (
      <span className="status-chip" style={NO_SUMMARY_STYLE}>
        —
      </span>
    )
  }
  return isExpiredFlag(isExpired) ? (
    <span
      className="status-chip"
      style={{ background: 'var(--sev-high-soft)', color: 'var(--sev-high)' }}
    >
      Expired
    </span>
  ) : (
    <span
      className="status-chip"
      style={{ background: 'var(--score-good-soft)', color: 'var(--score-good)' }}
    >
      Current
    </span>
  )
}

/**
 * The Decision column's chip. With an `onOpen` it is the control that opens
 * the row's summary — a button, as the portal had it, not a span: the chip is
 * the only way into `summary_report`, so it has to look and behave clickable.
 * Without one (the legend in decision-help) it stays inert text.
 */
export function DecisionChip({
  decision,
  hasSummary = true,
  onOpen,
}: {
  decision: string | null
  hasSummary?: boolean
  onOpen?: () => void
}) {
  if (!hasSummary) {
    return (
      <span className="status-chip" style={NO_SUMMARY_STYLE} title="No summary available">
        No Summary
      </span>
    )
  }
  const style = decision
    ? (DECISION_STYLE[decision] ?? { background: 'var(--sev-low-soft)', color: 'var(--sev-low)' })
    : { background: 'var(--sev-low-soft)', color: 'var(--sev-low)' }
  const label = decision ? (DECISION_LABELS[decision] ?? decision) : 'Summary'

  if (!onOpen) {
    return (
      <span
        className="status-chip sr-priority"
        style={{ border: '1px solid currentColor', ...style }}
      >
        {label}
      </span>
    )
  }
  return (
    <button
      type="button"
      className="status-chip sr-priority"
      style={{ border: '1px solid currentColor', cursor: 'pointer', ...style }}
      title="View the content summary"
      onClick={onOpen}
    >
      {label}
    </button>
  )
}

/**
 * True whether `is_expired` came back as the real boolean `true` or, as some
 * worker runs emit it, the string `"true"`. A plain truthy check would also
 * treat the string `"false"` as expired, so this is the one place that decides
 * "expired".
 */
export function isExpiredFlag(isExpired: unknown): boolean {
  return isExpired === true || isExpired === 'true'
}

const SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'] as const
export type Severity = (typeof SEVERITIES)[number]

export function severityToken(priority: string | null | undefined): Severity {
  const p = (priority ?? 'info').toLowerCase()
  return (SEVERITIES as readonly string[]).includes(p) ? (p as Severity) : 'info'
}

export function SeverityChip({ priority }: { priority: string | null | undefined }) {
  const sev = severityToken(priority)
  return (
    <span
      className="badge"
      style={{
        background: `var(--sev-${sev}-soft)`,
        color: `var(--sev-${sev})`,
        borderColor: 'transparent',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        fontSize: 11,
      }}
    >
      {sev}
    </span>
  )
}
