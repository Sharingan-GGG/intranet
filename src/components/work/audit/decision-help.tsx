'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

import { DECISION_DESCRIPTIONS, DECISION_LABELS, DecisionChip } from './audit-chips'

/**
 * The "?" beside the Decision column header, explaining what each decision
 * means.
 *
 * The list is deduped on the *rendered label*, not the key:
 * `needs_major_rewrite` and `expired_needs_refresh` are distinct values from
 * the seo-summary agent but both render as one "Rewrite - Expired" chip, so
 * keying on the raw value would show the same chip twice with the same
 * description under it.
 */
export function DecisionHelp() {
  const seen = new Set<string>()
  const items = Object.entries(DECISION_LABELS).filter(([, label]) => {
    if (seen.has(label)) return false
    seen.add(label)
    return true
  })

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="decision-help"
          data-decision-help=""
          title="What each decision means"
          aria-label="What each decision means"
        >
          ?
        </button>
      </DialogTrigger>

      <DialogContent className="decision-help__dialog">
        <DialogHeader>
          <DialogTitle>Decisions</DialogTitle>
          <DialogDescription>
            What the content audit recommends for a page, from the seo-summary agent.
          </DialogDescription>
        </DialogHeader>

        <ul className="decision-help__list">
          {items.map(([key]) => (
            <li key={key} className="decision-help__item">
              <DecisionChip decision={key} />
              <span className="decision-help__text">{DECISION_DESCRIPTIONS[key]}</span>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
