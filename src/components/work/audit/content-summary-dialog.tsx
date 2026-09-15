'use client'

/**
 * Read-only view of one content audit's `summary_report`, opened from the
 * Decision chip in the Dashboard's Content Pre-Check table.
 *
 * The document is fetched when the dialog opens rather than carried on every
 * row: `summary_report` (with `report`) runs to megabytes per domain, and the
 * list query deliberately selects only the two fields the table paints. So the
 * dialog appears straight away and fills in when the row lands — the same
 * sequence the portal's `openContentAuditSummary` used.
 */
import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'

import { getContentAuditSummary } from '@/app/audit/actions'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { SummaryReport } from '@/lib/audit-report'

import { isExpiredFlag } from './audit-chips'

/**
 * Critical and high get their own severity colour; every other priority
 * (medium, low, info, or unset) shares one neutral tier, so the two that
 * need acting on are the two that stand out.
 */
function PriorityChip({ priority }: { priority: string | undefined }) {
  const p = (priority ?? 'info').toLowerCase()
  const style =
    p === 'critical'
      ? { background: 'var(--sev-critical-soft)', color: 'var(--sev-critical)' }
      : p === 'high'
        ? { background: 'var(--sev-high-soft)', color: 'var(--sev-high)' }
        : { background: 'var(--sev-low-soft)', color: 'var(--sev-low)' }
  return (
    <span className="status-chip sr-priority" style={style}>
      {p}
    </span>
  )
}

export function ContentSummaryDialog({
  contentAuditId,
  url,
  onClose,
}: {
  /** null closes the dialog; a new id reopens it against that row. */
  contentAuditId: string | null
  url: string | null
  onClose: () => void
}) {
  const [summary, setSummary] = useState<SummaryReport | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!contentAuditId) return
    let live = true
    setSummary(null)
    setLoading(true)
    void getContentAuditSummary(contentAuditId).then((row) => {
      // Bail if the dialog was closed, or reopened on another row, while this
      // was in flight.
      if (!live) return
      setSummary(row)
      setLoading(false)
    })
    return () => {
      live = false
    }
  }, [contentAuditId])

  return (
    <Dialog open={contentAuditId != null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="audit-summary-dialog">
        <DialogHeader>
          <DialogTitle>Content Summary</DialogTitle>
          <DialogDescription asChild={url != null}>
            {url ? (
              // New tab, not this one: the dialog is a reading aid for the row
              // behind it, and navigating away would throw the list away.
              <a className="sr-url" href={url} target="_blank" rel="noopener noreferrer">
                {url} ↗
              </a>
            ) : (
              <>What the content audit found for this page.</>
            )}
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <p className="muted small flex items-center gap-2 py-3">
            <Loader2 className="animate-spin" size={14} aria-hidden /> Loading summary…
          </p>
        )}
        {!loading && !summary && <p className="muted small py-3">No summary available.</p>}
        {!loading && summary && <SummaryReportBody report={summary} />}
      </DialogContent>
    </Dialog>
  )
}

function SummaryReportBody({ report }: { report: SummaryReport }) {
  const expired = isExpiredFlag(report.expiry?.is_expired)

  return (
    <div className="summary-report">
      {(report.content_quality_score || report.decision) && (
        <div className="sr-section">
          {report.content_quality_score && (
            <div className="sr-row">
              <span className="sr-label">Content Quality Score</span>
              <b>{report.content_quality_score}</b>
            </div>
          )}
          {report.decision && (
            <div className="sr-row">
              <span className="sr-label">Decision</span>
              <PriorityChip priority={report.decision} />
            </div>
          )}
        </div>
      )}

      {report.summary && (
        <div className="sr-section">
          <h4>Summary</h4>
          <p>{report.summary}</p>
        </div>
      )}

      {report.decision_reason && (
        <div className="sr-section">
          <h4>Decision Reason</h4>
          <p>{report.decision_reason}</p>
        </div>
      )}

      {report.expiry && (
        <div className="sr-section">
          <h4>Expiry</h4>
          <div className="sr-row">
            <span className="sr-label">Status</span>
            <span
              className="status-chip"
              style={
                expired
                  ? { background: 'var(--sev-critical-soft)', color: 'var(--sev-critical)' }
                  : { background: 'var(--score-good-soft)', color: 'var(--score-good)' }
              }
            >
              {expired ? 'Expired' : 'Current'}
            </span>
          </div>
          {report.expiry.confidence && (
            <div className="sr-row">
              <span className="sr-label">Confidence</span>
              {report.expiry.confidence}
            </div>
          )}
          {!!report.expiry.signals?.length && (
            <ul className="sr-list">
              {report.expiry.signals.map((signal, i) => (
                <li key={i}>{signal}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!!report.action_summary?.length && (
        <div className="sr-section">
          <h4>Action Summary</h4>
          <ul className="sr-actions">
            {report.action_summary.map((action, i) => (
              <li key={i}>
                <PriorityChip priority={action.priority} />
                <span>{action.action ?? ''}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
