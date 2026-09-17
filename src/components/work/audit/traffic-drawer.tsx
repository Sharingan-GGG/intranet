'use client'

/**
 * The slide-over that holds a page's traffic detail.
 *
 * Presentation only — its contents are a server component rendered into it by
 * the intercepting route, so opening the drawer costs the five GA calls for
 * that page and nothing else. The table behind it is never re-fetched.
 *
 * Closing is `router.back()` rather than a state flip, because the drawer *is*
 * a history entry: it was opened by a navigation, so the browser's own Back has
 * to close it too or the two disagree.
 */
import { XIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef } from 'react'

export function AuditTrafficDrawer({
  children,
  onClose,
}: {
  children: React.ReactNode
  /**
   * Supplied by the Dashboard, whose drawer is component state rather than a
   * route — intercepting across that segment would re-run the whole queue. On
   * the Traffic screen the drawer *is* a history entry, so closing there has to
   * be `router.back()` or the browser's own Back would disagree with it.
   */
  onClose?: () => void
}) {
  const router = useRouter()
  const panel = useRef<HTMLDivElement>(null)

  const close = useCallback(() => {
    if (onClose) onClose()
    else router.back()
  }, [onClose, router])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)

    // Hold the page still behind the drawer. Restoring the previous value
    // rather than clearing it: the audit tree renders its own <body>, and
    // assuming it was empty would undo anything else that had set it.
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Move focus into the panel so the first Tab lands inside the dialog and
    // Escape is heard without the user clicking first.
    panel.current?.focus()

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [close])

  return (
    <div className="ga4-drawer" role="presentation">
      {/* A real button, not a click handler on a div: the backdrop is a control
          and screen readers should be able to reach it. */}
      <button
        type="button"
        className="ga4-drawer__scrim"
        aria-label="Close page traffic"
        onClick={close}
      />
      <div
        className="ga4-drawer__panel"
        role="dialog"
        aria-modal="true"
        aria-label="Page traffic"
        tabIndex={-1}
        ref={panel}
      >
        <button type="button" className="ga4-drawer__close tb-icon" onClick={close} aria-label="Close">
          <XIcon size={16} aria-hidden />
        </button>
        <div className="ga4-drawer__body">{children}</div>
      </div>
    </div>
  )
}
